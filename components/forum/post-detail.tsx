"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { LostClaimPanel } from "@/components/chat/lost-claim-panel";
import { Avatar } from "@/components/forum/avatar";
import { CommentThread } from "@/components/forum/comment-thread";
import { ComposerDialog } from "@/components/forum/composer-dialog";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PRODUCT_NAME } from "@/lib/brand";
import type { ForumComment, ForumPost } from "@/lib/campus/forum-shared";
import {
  displayName,
  formatAbsoluteTime,
  formatRelativeTime,
  postNumber,
} from "@/lib/forum/format";

function statusText(post: ForumPost) {
  if (post.lostItemStatus === "closed") {
    return "已解决";
  }
  if (post.lostItemStatus === "open") {
    return post.category === "招领" ? "待认领" : "寻找中";
  }
  return "进行中";
}

export function PostDetail({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<ForumPost | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ForumComment | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const reload = useCallback(async () => {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const [postResponse, commentResponse] = await Promise.all([
      fetch(`${basePath}/api/forum?id=${encodeURIComponent(postId)}`),
      fetch(
        `${basePath}/api/forum/comments?postId=${encodeURIComponent(postId)}`
      ),
    ]);
    if (postResponse.status === 400) {
      setMissing(true);
      return;
    }
    if (!postResponse.ok) {
      throw new Error("load failed");
    }
    const postData = (await postResponse.json()) as { posts: ForumPost[] };
    const found = postData.posts?.[0] ?? null;
    setPost(found);
    if (!found) {
      setMissing(true);
      return;
    }
    setMissing(false);
    if (commentResponse.ok) {
      const commentData = (await commentResponse.json()) as {
        comments: ForumComment[];
      };
      setComments(commentData.comments);
    }
  }, [postId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    reload()
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const focusReply = () => {
    replyRef.current?.focus();
    replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败，手动复制地址栏吧");
    }
  };

  const remove = async () => {
    if (!post) {
      return;
    }
    if (!window.confirm(`确定删除「${post.title}」吗？删除后不可恢复。`)) {
      return;
    }
    setActionBusy(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(
        `${basePath}/api/forum?id=${encodeURIComponent(post.id)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "删除失败");
        return;
      }
      toast.success("帖子已删除");
      router.push("/forum");
    } catch {
      toast.error("删除失败");
    } finally {
      setActionBusy(false);
    }
  };

  const resolve = async () => {
    if (!post) {
      return;
    }
    setActionBusy(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(
        `${basePath}/api/forum?id=${encodeURIComponent(post.id)}`,
        {
          body: JSON.stringify({ action: "resolve" }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "操作失败");
        return;
      }
      toast.success("已标记为已解决");
      await reload();
    } catch {
      toast.error("操作失败");
    } finally {
      setActionBusy(false);
    }
  };

  const submitComment = async () => {
    if (!post) {
      return;
    }
    const text = body.trim();
    if (!text) {
      return;
    }
    setBusy(true);
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(`${basePath}/api/forum/comments`, {
        body: JSON.stringify({
          body: text,
          parentId: replyTo?.id,
          postId: post.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "评论失败");
        return;
      }
      const data = (await response.json()) as { comment: ForumComment };
      setComments((current) => [...current, data.comment]);
      setBody("");
      setReplyTo(null);
    } catch {
      toast.error("评论失败");
    } finally {
      setBusy(false);
    }
  };

  const canResolve = Boolean(
    post?.mine && post.lostItemId && post.lostItemStatus === "open"
  );

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-12 w-full max-w-[1000px] items-center gap-4 px-4 md:px-8">
          <SidebarTrigger className="-ml-1.5 md:hidden" />
          <Link
            className="text-[14px] font-semibold tracking-[-0.01em] text-foreground"
            href="/forum"
          >
            {PRODUCT_NAME}
            <span className="ml-1.5 text-[12px] font-normal text-foreground/45">
              论坛
            </span>
          </Link>
          <Link
            className="ml-auto text-[12.5px] text-foreground/50 transition-colors duration-150 hover:text-primary"
            href="/forum"
          >
            返回论坛
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[720px] px-4 pb-24 md:px-8">
        {loading ? (
          <div className="pt-8">
            <div className="h-3 w-32 rounded-[3px] bg-muted" />
            <div className="mt-4 h-6 w-4/5 rounded-[3px] bg-muted" />
            <div className="mt-3 h-3 w-48 rounded-[3px] bg-muted" />
            <div className="mt-8 h-3 w-full rounded-[3px] bg-muted" />
            <div className="mt-2.5 h-3 w-11/12 rounded-[3px] bg-muted" />
            <div className="mt-2.5 h-3 w-2/3 rounded-[3px] bg-muted" />
          </div>
        ) : null}

        {!loading && failed ? (
          <div className="py-20 text-center">
            <p className="text-[13.5px] text-foreground/55">
              没拉到帖子，可能是网的问题。
            </p>
            <button
              className="mt-2 text-[13px] text-primary hover:underline"
              onClick={() => {
                setLoading(true);
                setFailed(false);
                reload()
                  .catch(() => setFailed(true))
                  .finally(() => setLoading(false));
              }}
              type="button"
            >
              刷新一下试试
            </button>
          </div>
        ) : null}

        {!loading && !failed && (missing || !post) ? (
          <div className="py-20 text-center">
            <p className="text-[13.5px] text-foreground/55">
              这条帖子不在了，或者链接不对。
            </p>
            <Link
              className="mt-2 inline-block text-[13px] text-primary hover:underline"
              href="/forum"
            >
              回到论坛
            </Link>
          </div>
        ) : null}

        {!loading && !failed && post ? (
          <>
            <nav className="pt-6 text-[12px] text-foreground/45">
              <Link className="hover:text-primary" href="/forum">
                论坛
              </Link>
              <span className="px-1.5">/</span>
              <Link
                className="hover:text-primary"
                href={`/forum?c=${encodeURIComponent(post.category)}`}
              >
                {post.category}
              </Link>
              <span className="px-1.5">/</span>
              <span>{postNumber(post.id)}</span>
            </nav>

            <h1 className="mt-3 text-[22px] font-semibold leading-[1.45] tracking-[-0.01em] text-foreground">
              {post.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-b border-border/60 pb-4 text-[12.5px] text-foreground/50">
              <Avatar author={post.author} size="md" />
              <span className="text-foreground/75">
                {displayName(post.author)}
              </span>
              <span aria-hidden="true">·</span>
              <time
                dateTime={post.createdAt}
                title={formatAbsoluteTime(post.createdAt)}
              >
                {formatRelativeTime(post.createdAt)}
              </time>
              {post.mine ? (
                <span className="text-foreground/40">· 我发布的</span>
              ) : null}
              <span className="ml-auto font-mono text-[11px] text-foreground/30">
                #1
              </span>
            </div>

            <div className="mt-5 whitespace-pre-wrap text-[14.5px] leading-[1.85] text-foreground/85">
              {post.body}
            </div>

            {post.place || post.eventTime || post.lostItemStatus ? (
              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3 rounded-[8px] border border-border bg-card px-4 py-3">
                {post.place ? (
                  <div>
                    <dt className="text-[11px] text-foreground/40">地点</dt>
                    <dd className="mt-0.5 text-[13px] text-foreground/80">
                      {post.place}
                    </dd>
                  </div>
                ) : null}
                {post.eventTime ? (
                  <div>
                    <dt className="text-[11px] text-foreground/40">时间</dt>
                    <dd className="mt-0.5 text-[13px] text-foreground/80">
                      {post.eventTime}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[11px] text-foreground/40">状态</dt>
                  <dd className="mt-0.5 text-[13px] text-foreground/80">
                    {statusText(post)}
                  </dd>
                </div>
              </dl>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-5 text-[13px]">
              <button
                className="text-foreground/65 transition-colors duration-150 hover:text-primary"
                onClick={focusReply}
                type="button"
              >
                回复
              </button>
              <button
                className="text-foreground/65 transition-colors duration-150 hover:text-primary"
                onClick={share}
                type="button"
              >
                复制链接
              </button>
              {post.mine ? (
                <button
                  className="text-foreground/65 transition-colors duration-150 hover:text-primary"
                  onClick={() => setComposerOpen(true)}
                  type="button"
                >
                  编辑
                </button>
              ) : null}
              {canResolve ? (
                <button
                  className="text-foreground/65 transition-colors duration-150 hover:text-primary disabled:opacity-50"
                  disabled={actionBusy}
                  onClick={resolve}
                  type="button"
                >
                  标记已解决
                </button>
              ) : null}
              {post.mine ? (
                <button
                  className="text-destructive/75 transition-colors duration-150 hover:text-destructive disabled:opacity-50"
                  disabled={actionBusy}
                  onClick={remove}
                  type="button"
                >
                  删除
                </button>
              ) : null}
            </div>

            {post.lostItemId ? (
              <LostClaimPanel itemId={post.lostItemId} postId={post.id} />
            ) : null}

            <section className="mt-10">
              <h2 className="text-[12px] font-medium tracking-[0.06em] text-foreground/45">
                {comments.length} 条回复
              </h2>

              {comments.length > 0 ? (
                <CommentThread comments={comments} onReply={setReplyTo} />
              ) : (
                <p className="mt-3 border-t border-border/60 py-6 text-[13px] text-foreground/45">
                  还没有人回复，也许你能帮上忙。
                </p>
              )}

              <div className="mt-5">
                {replyTo ? (
                  <div className="mb-2 flex items-center gap-2 text-[12px] text-foreground/50">
                    <span>
                      回复 {displayName(replyTo.author)}：
                      {replyTo.body.slice(0, 24)}
                      {replyTo.body.length > 24 ? "…" : ""}
                    </span>
                    <button
                      className="text-primary hover:underline"
                      onClick={() => setReplyTo(null)}
                      type="button"
                    >
                      取消
                    </button>
                  </div>
                ) : null}
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitComment();
                  }}
                >
                  <textarea
                    className="min-h-[76px] w-full resize-y rounded-[6px] border border-border bg-card px-3 py-2 text-[13.5px] leading-[1.7] text-foreground outline-none transition-colors duration-150 placeholder:text-foreground/35 focus:border-primary/60"
                    maxLength={500}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="写点什么…"
                    ref={replyRef}
                    value={body}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] text-foreground/35">
                      请勿在回复里发手机号或证件号
                    </span>
                    <button
                      className="inline-flex h-8 items-center rounded-[6px] bg-primary px-4 text-[12.5px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50"
                      disabled={busy || !body.trim()}
                      type="submit"
                    >
                      {busy ? "发送中…" : "发送"}
                    </button>
                  </div>
                </form>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <ComposerDialog
        onOpenChange={setComposerOpen}
        onSaved={() => {
          void reload();
        }}
        open={composerOpen}
        post={post}
      />
    </div>
  );
}
