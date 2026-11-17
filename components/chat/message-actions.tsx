import equal from "fast-deep-equal";
import { memo, useCallback } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import {
  MessageAction as Action,
  MessageActions as Actions,
} from "../ai-elements/message";
import { CopyIcon, PencilEditIcon, ThumbDownIcon, ThumbUpIcon } from "./icons";

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  onEdit,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  onEdit?: () => void;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = useCallback(async () => {
    if (!textFromParts) {
      toast.error("没有可复制的文字");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("已复制");
  }, [copyToClipboard, textFromParts]);

  const handleUpvote = useCallback(() => {
    const upvote = fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
      {
        body: JSON.stringify({
          chatId,
          messageId: message.id,
          type: "up",
        }),
        method: "PATCH",
      }
    );

    toast.promise(upvote, {
      error: "评价失败",
      loading: "正在提交…",
      success: () => {
        mutate<Vote[]>(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
          (currentVotes) => {
            if (!currentVotes) {
              return [];
            }

            const votesWithoutCurrent = currentVotes.filter(
              (currentVote) => currentVote.messageId !== message.id
            );

            return [
              ...votesWithoutCurrent,
              {
                chatId,
                isUpvoted: true,
                messageId: message.id,
              },
            ];
          },
          { revalidate: false }
        );

        return "感谢你的认可";
      },
    });
  }, [chatId, message.id, mutate]);

  const handleDownvote = useCallback(() => {
    const downvote = fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote`,
      {
        body: JSON.stringify({
          chatId,
          messageId: message.id,
          type: "down",
        }),
        method: "PATCH",
      }
    );

    toast.promise(downvote, {
      error: "评价失败",
      loading: "正在提交…",
      success: () => {
        mutate<Vote[]>(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/vote?chatId=${chatId}`,
          (currentVotes) => {
            if (!currentVotes) {
              return [];
            }

            const votesWithoutCurrent = currentVotes.filter(
              (currentVote) => currentVote.messageId !== message.id
            );

            return [
              ...votesWithoutCurrent,
              {
                chatId,
                isUpvoted: false,
                messageId: message.id,
              },
            ];
          },
          { revalidate: false }
        );

        return "已收到反馈，我们会改进";
      },
    });
  }, [chatId, message.id, mutate]);

  if (isLoading) {
    return null;
  }

  if (message.role === "user") {
    return (
      <Actions className="-mr-0.5 justify-end opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
        <div className="flex items-center gap-0.5">
          {onEdit ? (
            <Action
              className="size-7 text-muted-foreground/50 hover:text-foreground"
              data-testid="message-edit-button"
              onClick={onEdit}
              tooltip="编辑"
            >
              <PencilEditIcon />
            </Action>
          ) : null}
          <Action
            className="size-7 text-muted-foreground/50 hover:text-foreground"
            onClick={handleCopy}
            tooltip="复制"
          >
            <CopyIcon />
          </Action>
        </div>
      </Actions>
    );
  }

  return (
    <Actions className="-ml-0.5 opacity-0 transition-opacity duration-150 group-hover/message:opacity-100">
      <Action
        className="text-muted-foreground/50 hover:text-foreground"
        onClick={handleCopy}
        tooltip="复制"
      >
        <CopyIcon />
      </Action>

      <Action
        className="text-muted-foreground/50 hover:text-foreground"
        data-testid="message-upvote"
        disabled={vote?.isUpvoted}
        onClick={handleUpvote}
        tooltip="有帮助"
      >
        <ThumbUpIcon />
      </Action>

      <Action
        className="text-muted-foreground/50 hover:text-foreground"
        data-testid="message-downvote"
        disabled={vote && !vote.isUpvoted}
        onClick={handleDownvote}
        tooltip="没帮助"
      >
        <ThumbDownIcon />
      </Action>
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }

    return true;
  }
);
