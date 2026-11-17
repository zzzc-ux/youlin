import { ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  streamText,
  toUIMessageStream,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { generateTitleFromUserMessage } from "@/lib/ai/generate-title";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { DEEPSEEK_MODEL, getLanguageModel, hasModelProvider } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { editDocument } from "@/lib/ai/tools/edit-document";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { logCampusTrace, runCampusEngine } from "@/lib/campus/engine";
import { PRODUCT_NAME } from "@/lib/brand";
import { isTestEnvironment } from "@/lib/constants";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { CampusTraceData, CampusTraceStep, ChatMessage, WaitingStatusData } from "@/lib/types";
import { convertToUIMessages, generateUUID, getTextFromMessage } from "@/lib/utils";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const [botIdResult, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth(),
    ]);

    if (botIdResult?.isBot) {
      return new ChatbotError("forbidden:api").toResponse();
    }

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = hasModelProvider() ? DEEPSEEK_MODEL : DEFAULT_CHAT_MODEL;
    void selectedChatModel;

    await checkIpRateLimit(ipAddress(request));

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      differenceInHours: 1,
      id: session.user.id,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        title: "新的对话",
        userId: session.user.id,
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            attachments: [],
            chatId: id,
            createdAt: new Date(),
            id: message.id,
            parts: message.parts,
            role: "user",
          },
        ],
      });
    }

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const modelName = chatModel;
        const writeWaitingStatus = (
          phase: WaitingStatusData["phase"],
          messageText: string
        ) => {
          dataStream.write({
            data: {
              message: messageText,
              modelId: chatModel,
              modelName,
              phase,
            },
            transient: true,
            type: "data-waiting-status",
          });
        };

        const userText = message ? getTextFromMessage(message) : "";
        if (!userText) {
          if (!isToolApprovalFlow) throw new Error("缺少用户消息");
          const continuation = streamText({
            model: getLanguageModel(chatModel) as Parameters<typeof streamText>[0]["model"],
            system: "处理用户对文档工具的确认。不要声称执行了未调用的校园操作。",
            messages: modelMessages,
            tools: {
              createDocument: createDocument({ dataStream, modelId: chatModel, session }),
              editDocument: editDocument({ dataStream, session }),
              requestSuggestions: requestSuggestions({ dataStream, modelId: chatModel, session }),
              updateDocument: updateDocument({ dataStream, modelId: chatModel, session }),
            },
          });
          dataStream.merge(toUIMessageStream({ sendReasoning: false, stream: continuation.stream }));
          return;
        }
        writeWaitingStatus("waiting", "正在理解你的问题…");
        const history = uiMessages.slice(0, -1).slice(-6).map((item) => ({
          role: item.role,
          text: getTextFromMessage(item),
        }));
        const traceId = generateUUID();
        let trace: CampusTraceData = { kindLabel: "处理中", tool: "", sources: [], found: false, steps: [] };
        const publishTrace = () => dataStream.write({ id: traceId, data: { ...trace, steps: [...(trace.steps ?? [])] }, type: "data-campus-trace" });
        const report = (step: CampusTraceStep) => {
          const steps = trace.steps ?? [];
          const index = steps.findIndex((item) => item.id === step.id);
          trace = { ...trace, steps: index < 0 ? [...steps, step] : steps.map((item) => item.id === step.id ? step : item) };
          publishTrace();
        };
        let outcome: Awaited<ReturnType<typeof runCampusEngine>>;
        try {
          outcome = await runCampusEngine({ text: userText, history, userId: session.user.id, chatId: id, author: session.user.email ?? "同学", report });
        } catch (error) {
          const running = trace.steps?.find((step) => step.state === "running");
          if (running) report({ ...running, label: "处理未能完成", state: "error" });
          console.error("Campus request failed", { chatId: id, error });
          await logCampusTrace(id, session.user.id, { kind: "unknown", kindLabel: "处理失败", tool: "", sources: [], found: false, evidence: "", answer: "" }).catch(() => undefined);
          throw error;
        }
        await logCampusTrace(id, session.user.id, outcome).catch((error) => console.error("Campus trace logging failed", error));
        trace = { ...trace, found: outcome.found, kindLabel: outcome.kindLabel, sources: outcome.sources, tool: outcome.tool };
        if (!outcome.found && outcome.tool && !(trace.steps ?? []).some((step) => step.id === "draft" || step.id === "execute")) {
          report({ id: "result", label: "需要进一步确认或补充信息", state: "waiting" });
        } else {
          publishTrace();
        }
        writeWaitingStatus("thinking", "正在整理回答…");
        if (outcome.kind === "unknown" && !/^(确认|取消)/.test(userText) && hasModelProvider() && !isTestEnvironment) {
          report({ id: "model", label: "正在生成一般问题的回答", state: "running" });
          const general = streamText({
            model: getLanguageModel(chatModel) as Parameters<typeof streamText>[0]["model"],
            system: `你的名字是${PRODUCT_NAME}。对闲聊或一般问题自然回答；没有资料时不要声称知道校园实时事实，也不要声称执行了任何操作。`,
            messages: modelMessages,
            onFinish: () => {
              if (trace.steps?.find((step) => step.id === "model")?.state !== "error") {
                report({ id: "model", label: "一般问题的回答已生成", state: "done" });
              }
            },
            onError: () => report({ id: "model", label: "回答生成失败", state: "error" }),
            tools: {
              createDocument: createDocument({ dataStream, modelId: chatModel, session }),
              editDocument: editDocument({ dataStream, session }),
              requestSuggestions: requestSuggestions({ dataStream, modelId: chatModel, session }),
              updateDocument: updateDocument({ dataStream, modelId: chatModel, session }),
            },
          });
          dataStream.merge(toUIMessageStream({ sendReasoning: false, stream: general.stream }));
        } else {
          const textId = "campus-text";
          dataStream.write({ type: "start" });
          dataStream.write({ type: "start-step" });
          dataStream.write({ id: textId, type: "text-start" });
          dataStream.write({ id: textId, type: "text-delta", delta: outcome.answer });
          dataStream.write({ id: textId, type: "text-end" });
          if (outcome.forumPostId) {
            dataStream.write({ type: "data-forum-post-link", data: { postId: outcome.forumPostId, label: outcome.forumPostLabel } });
          }
          dataStream.write({ type: "finish-step" });
          dataStream.write({ finishReason: "stop", type: "finish" });
        }
        if (titlePromise) {
          try {
            const title = await titlePromise;
            dataStream.write({ data: title, type: "data-chat-title" });
            await updateChatTitleById({ chatId: id, title });
          } catch { /* 标题生成失败不影响回答 */ }
        }

      },
      generateId: generateUUID,
      onEnd: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          await Promise.all(
            finishedMessages.map(async (finishedMsg) => {
              const existingMsg = uiMessages.find(
                (m) => m.id === finishedMsg.id
              );
              if (existingMsg) {
                await updateMessage({
                  id: finishedMsg.id,
                  parts: finishedMsg.parts,
                });
                return;
              }

              await saveMessages({
                messages: [
                  {
                    attachments: [],
                    chatId: id,
                    createdAt: new Date(),
                    id: finishedMsg.id,
                    parts: finishedMsg.parts,
                    role: finishedMsg.role,
                  },
                ],
              });
            })
          );
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              attachments: [],
              chatId: id,
              createdAt: new Date(),
              id: currentMessage.id,
              parts: currentMessage.parts,
              role: currentMessage.role,
            })),
          });
        }
      },
      onError: (error) => {
        if (
          error instanceof Error &&
          error.message?.includes(
            "AI Gateway requires a valid credit card on file to service requests"
          )
        ) {
          return "模型服务暂不可用，请联系管理员检查模型配置。";
        }
        return "出了点问题，请稍后再试。";
      },
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
    });

    return createUIMessageStreamResponse({
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ chatId: id, streamId });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch {
          /* non-critical */
        }
      },
      stream,
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatbotError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
