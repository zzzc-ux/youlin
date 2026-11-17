import type { LanguageModel } from "ai";

const usage = {
  inputTokens: { cacheRead: 0, cacheWrite: 0, noCache: 10, total: 10 },
  outputTokens: { reasoning: 0, text: 20, total: 20 },
};

function readPrompt(prompt: unknown): string {
  if (typeof prompt === "string") {
    return prompt;
  }

  try {
    const raw = JSON.stringify(prompt);
    const matches = [
      ...raw.matchAll(/"text":"((?:\\.|[^"\\])*)"/g),
    ].map((match) => JSON.parse(`"${match[1]}"`) as string);
    return matches.at(-1) ?? "";
  } catch {
    return "";
  }
}

function localReply(prompt: unknown): string {
  const userText = readPrompt(prompt).trim();
  const quoted = userText ? `\n\n你刚才说：${userText.slice(0, 500)}` : "";
  return `本地演示已经跑通。当前没有配置大模型密钥（DEEPSEEK_API_KEY），所以这是本地占位回复，不是大模型生成的内容。聊天记录保存在本机数据库里。${quoted}`;
}

function localTitle(prompt: unknown): string {
  const userText = readPrompt(prompt).replace(/\s+/g, " ").trim();
  return userText.slice(0, 24) || "本地对话";
}

function streamText(text: string) {
  const words = text.split(" ");
  return {
    stream: new ReadableStream({
      async start(controller) {
        controller.enqueue({ id: "t1", type: "text-start" });
        await words.reduce<Promise<void>>(async (previous, word, index) => {
          await previous;
          const suffix = index === words.length - 1 ? "" : " ";
          controller.enqueue({
            delta: `${word}${suffix}`,
            id: "t1",
            type: "text-delta",
          });
        }, Promise.resolve());
        controller.enqueue({ id: "t1", type: "text-end" });
        controller.enqueue({
          finishReason: "stop",
          type: "finish",
          usage,
        });
        controller.close();
      },
    }),
  };
}

function createModel(
  modelId: string,
  respond: (prompt: unknown) => string
): LanguageModel {
  return {
    doGenerate: async ({ prompt }: { prompt: unknown }) => ({
      content: [{ text: respond(prompt), type: "text" }],
      finishReason: "stop",
      usage,
      warnings: [],
    }),
    doStream: ({ prompt }: { prompt: unknown }) => streamText(respond(prompt)),
    modelId,
    provider: "local",
    specificationVersion: "v3",
    supportedUrls: {},
  } as unknown as LanguageModel;
}

export const localChatModel = createModel("local-chat", localReply);
export const localTitleModel = createModel("local-title", localTitle);
