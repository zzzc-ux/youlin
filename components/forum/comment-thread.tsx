"use client";

import { Avatar } from "@/components/forum/avatar";
import type { ForumComment } from "@/lib/campus/forum-shared";
import {
  displayName,
  formatAbsoluteTime,
  formatRelativeTime,
} from "@/lib/forum/format";

function CommentHead({
  comment,
  floor,
}: {
  comment: ForumComment;
  floor: number;
}) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-foreground/50">
      <Avatar author={comment.author} size="sm" />
      <span className="text-foreground/75">{displayName(comment.author)}</span>
      {comment.mine ? <span className="text-foreground/40">我</span> : null}
      <span aria-hidden="true">·</span>
      <time
        dateTime={comment.createdAt}
        title={formatAbsoluteTime(comment.createdAt)}
      >
        {formatRelativeTime(comment.createdAt)}
      </time>
      <span className="ml-auto font-mono text-[11px] text-foreground/30">
        #{floor}
      </span>
    </div>
  );
}

function CommentBody({
  comment,
  onReply,
}: {
  comment: ForumComment;
  onReply: (comment: ForumComment) => void;
}) {
  return (
    <>
      <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-[1.75] text-foreground/80">
        {comment.body}
      </p>
      <button
        className="mt-1 text-[12px] text-foreground/40 transition-colors duration-150 hover:text-primary"
        onClick={() => onReply(comment)}
        type="button"
      >
        回复
      </button>
    </>
  );
}

export function CommentThread({
  comments,
  onReply,
}: {
  comments: ForumComment[];
  onReply: (comment: ForumComment) => void;
}) {
  const floors = new Map(
    comments.map((comment, index) => [comment.id, index + 2])
  );
  const roots = comments.filter((comment) => !comment.parentId);

  return (
    <ol className="mt-3">
      {roots.map((root) => {
        const children = comments.filter(
          (comment) => comment.parentId === root.id
        );
        return (
          <li className="border-t border-border/60 py-4" key={root.id}>
            <CommentHead comment={root} floor={floors.get(root.id) ?? 2} />
            <CommentBody comment={root} onReply={onReply} />

            {children.length > 0 ? (
              <ol className="mt-2.5 ml-3.5 border-l border-border pl-3.5">
                {children.map((child) => (
                  <li className="py-2.5" key={child.id}>
                    <CommentHead
                      comment={child}
                      floor={floors.get(child.id) ?? 2}
                    />
                    <CommentBody comment={child} onReply={onReply} />
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
