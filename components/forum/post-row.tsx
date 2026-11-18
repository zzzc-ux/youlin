import Link from "next/link";
import { Avatar } from "@/components/forum/avatar";
import { CategoryTag, type ForumStatus } from "@/components/forum/category-tag";
import type { ForumPost } from "@/lib/campus/forum-shared";
import {
  displayName,
  excerpt,
  formatAbsoluteTime,
  formatRelativeTime,
} from "@/lib/forum/format";

function statusOf(post: ForumPost): ForumStatus {
  if (post.lostItemStatus === "closed") {
    return "done";
  }
  if (post.lostItemStatus === "open") {
    return "open";
  }
  return null;
}

function replyLine(post: ForumPost) {
  const count = post.commentCount ?? 0;
  if (count > 0 && post.lastReplyAt) {
    const author = post.lastReplyAuthor
      ? displayName(post.lastReplyAuthor)
      : "有人";
    const isOwner =
      post.lastReplyAuthor !== null &&
      post.lastReplyAuthor !== undefined &&
      displayName(post.lastReplyAuthor) === displayName(post.author);
    return `${count} 条回复 · ${isOwner ? "楼主" : author} ${formatRelativeTime(post.lastReplyAt)}`;
  }
  return "还没有人回复，也许你能帮上忙";
}

export function PostRow({ post }: { post: ForumPost }) {
  const where = post.eventTime || post.place;

  return (
    <article className="border-b border-border/60">
      <Link
        className="group -mx-2 block rounded-[6px] px-2 py-4 transition-colors duration-150 hover:bg-foreground/[0.03] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        href={`/forum/${post.id}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-foreground/50">
          <CategoryTag category={post.category} status={statusOf(post)} />
          {where ? <span className="text-foreground/55">{where}</span> : null}
          <span aria-hidden="true">·</span>
          <time
            dateTime={post.createdAt}
            title={formatAbsoluteTime(post.createdAt)}
          >
            {formatRelativeTime(post.createdAt)}
          </time>
        </div>

        <h3 className="mt-2 text-[15.5px] font-medium leading-[1.5] tracking-[-0.005em] text-foreground transition-colors duration-150 group-hover:text-primary">
          {post.title}
        </h3>

        <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.7] text-foreground/65">
          {excerpt(post.body)}
        </p>

        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-foreground/50">
          <Avatar author={post.author} size="xs" />
          <span className="text-foreground/70">{displayName(post.author)}</span>
          <span aria-hidden="true">·</span>
          <span>{replyLine(post)}</span>
          {post.mine ? (
            <span className="text-foreground/35">· 我发布的</span>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
