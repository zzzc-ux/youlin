"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Clock3, CornerDownRight, MapPin, MessageCircle, PenLine, Pencil, Search, Send, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/effects/brand-mark";
import { SpotlightCard } from "@/components/effects/spotlight-card";
import {
  BlurText,
  FadeIn,
  GradientText,
  ShinyText,
} from "@/components/effects/text-effects";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LostClaimPanel } from "@/components/chat/lost-claim-panel";
import { forumCategories, type ForumComment, type ForumPost } from "@/lib/campus/forum-shared";
import { PRODUCT_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const emptyForm = {
  body: "",
  category: "活动",
  eventTime: "",
  place: "",
  title: "",
};

const CATEGORY_STYLE: Record<string, { badge: string; glow: string; avatar: string }> = {
  求助: {
    avatar: "from-rose-400 to-orange-400",
    badge: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:bg-rose-400/12 dark:text-rose-200 dark:ring-rose-300/25",
    glow: "oklch(0.72 0.17 20 / 0.2)",
  },
  招领: {
    avatar: "from-sky-400 to-cyan-400",
    badge: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:bg-sky-400/12 dark:text-sky-200 dark:ring-sky-300/25",
    glow: "oklch(0.75 0.13 230 / 0.2)",
  },
  活动: {
    avatar: "from-violet-400 to-fuchsia-400",
    badge: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:bg-violet-400/12 dark:text-violet-200 dark:ring-violet-300/25",
    glow: "oklch(0.72 0.18 300 / 0.2)",
  },
  社团: {
    avatar: "from-emerald-400 to-teal-400",
    badge: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-400/12 dark:text-emerald-200 dark:ring-emerald-300/25",
    glow: "oklch(0.75 0.15 165 / 0.2)",
  },
  讲座: {
    avatar: "from-indigo-400 to-blue-400",
    badge: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:bg-indigo-400/12 dark:text-indigo-200 dark:ring-indigo-300/25",
    glow: "oklch(0.7 0.16 270 / 0.2)",
  },
  闲置: {
    avatar: "from-amber-400 to-yellow-400",
    badge: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:bg-amber-400/12 dark:text-amber-200 dark:ring-amber-300/25",
    glow: "oklch(0.8 0.14 75 / 0.2)",
  },
};

const fieldClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-[border-color,box-shadow] focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/15";

const MINE_TAB = "我的贴子";

const formatCommentTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("zh-CN", { day: "numeric", hour: "2-digit", minute: "2-digit", month: "numeric" });
};

export function ForumBoard({ initialPostId }: { initialPostId?: string }) {
  const router = useRouter();
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<ForumComment | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);

  const loadPosts = useCallback(async (nextCategory: string, nextQuery: string, postId?: string) => {
    const params = new URLSearchParams();
    if (postId) {
      params.set("id", postId);
    } else if (nextCategory === MINE_TAB) {
      params.set("mine", "1");
    } else if (nextCategory !== "全部") {
      params.set("category", nextCategory);
    }
    if (!postId && nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forum?${params.toString()}`);
    if (postId && response.status === 400) {
      setPosts([]);
      return;
    }
    if (!response.ok) {
      throw new Error("加载失败");
    }
    const data = (await response.json()) as { posts: ForumPost[] };
    setPosts(data.posts);
  }, []);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    loadPosts(category, "", initialPostId)
      .catch(() => { setLoadError(true); toast.error("论坛暂时打不开"); })
      .finally(() => setLoading(false));
  }, [category, initialPostId, loadPosts]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      await loadPosts(category, query);
    } catch {
      toast.error("没有查到帖子");
    } finally {
      setLoading(false);
    }
  };

  const reloadPosts = useCallback(
    () => loadPosts(category, initialPostId ? "" : query, initialPostId),
    [loadPosts, category, query, initialPostId]
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const editing = editingId;
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(
        editing ? `${basePath}/api/forum?id=${encodeURIComponent(editing)}` : `${basePath}/api/forum`,
        {
          body: JSON.stringify(form),
          headers: { "Content-Type": "application/json" },
          method: editing ? "PATCH" : "POST",
        }
      );
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? (editing ? "保存失败" : "发布失败"));
        return;
      }
      const data = (await response.json()) as { post: ForumPost };
      const wasRedacted = data.post.body !== form.body || data.post.title !== form.title || (data.post.place ?? "") !== form.place || (data.post.eventTime ?? "") !== form.eventTime;
      toast.success(wasRedacted ? (editing ? "已保存，部分个人信息已隐藏" : "已发布，部分个人信息已隐藏") : (editing ? "已保存修改" : "已发到论坛"));
      setForm(emptyForm);
      setEditingId(null);
      if (initialPostId) {
        if (editing) {
          await reloadPosts();
        } else {
          router.push(`/forum?post=${encodeURIComponent(data.post.id)}`);
        }
      } else {
        await reloadPosts();
      }
    } catch {
      toast.error(editingId ? "保存失败" : "发布失败");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (post: ForumPost) => {
    setEditingId(post.id);
    setForm({
      body: post.body,
      category: post.category,
      eventTime: post.eventTime ?? "",
      place: post.place ?? "",
      title: post.title,
    });
    document.getElementById("forum-composer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleDelete = async (post: ForumPost) => {
    if (!window.confirm(`确定删除帖子「${post.title}」吗？删除后不可恢复。`)) {
      return;
    }
    setActionBusy(post.id);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forum?id=${encodeURIComponent(post.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "删除失败");
        return;
      }
      toast.success("帖子已删除");
      if (editingId === post.id) {
        cancelEdit();
      }
      if (initialPostId) {
        router.push("/forum");
      } else {
        await reloadPosts();
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setActionBusy(null);
    }
  };

  const handleResolve = async (post: ForumPost) => {
    setActionBusy(post.id);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forum?id=${encodeURIComponent(post.id)}`, {
        body: JSON.stringify({ action: "resolve" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        toast.error(data.error ?? "操作失败");
        return;
      }
      toast.success("已标记为已解决");
      await reloadPosts();
    } catch {
      toast.error("操作失败");
    } finally {
      setActionBusy(null);
    }
  };

  const update = (key: keyof typeof emptyForm) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const toggleComments = async (post: ForumPost) => {
    if (expandedId === post.id) {
      setExpandedId(null);
      setReplyTo(null);
      return;
    }
    setExpandedId(post.id);
    setReplyTo(null);
    setCommentBody("");
    setComments([]);
    setCommentsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forum/comments?postId=${encodeURIComponent(post.id)}`);
      if (!response.ok) {
        throw new Error("加载失败");
      }
      const data = (await response.json()) as { comments: ForumComment[] };
      setComments(data.comments);
    } catch {
      toast.error("评论加载失败");
    } finally {
      setCommentsLoading(false);
    }
  };

  const submitComment = async (post: ForumPost) => {
    const body = commentBody.trim();
    if (!body) {
      return;
    }
    setCommentBusy(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forum/comments`, {
        body: JSON.stringify({ body, parentId: replyTo?.id, postId: post.id }),
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
      setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, commentCount: (item.commentCount ?? 0) + 1 } : item)));
      setCommentBody("");
      setReplyTo(null);
    } catch {
      toast.error("评论失败");
    } finally {
      setCommentBusy(false);
    }
  };

  return (
    <div className="relative h-dvh overflow-y-auto">
      <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background px-3 md:hidden">
        <SidebarTrigger />
        <BrandMark size={22} />
        <ShinyText className="font-semibold text-[14px]">{PRODUCT_NAME}</ShinyText>
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <header className="flex flex-col gap-3">
          <FadeIn>
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[12px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-fuchsia-400 shadow-[0_0_10px_2px_oklch(0.7_0.25_320/0.6)]" />
              校园论坛
            </span>
          </FadeIn>
          <h1 className="font-semibold text-[30px] tracking-tight md:text-[40px]">
            <BlurText delay={0.1} text="活动、社团和互助，" />
            <GradientText>
              <BlurText delay={0.4} text="都发在这里" />
            </GradientText>
          </h1>
          <FadeIn delay={0.6}>
            <p className="max-w-2xl text-[14px] text-muted-foreground leading-7">
              发帖后，也可以回到对话里问“这周有什么活动”，助手会按这些帖子查找。
            </p>
          </FadeIn>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* 帖子列表 */}
          <section className="flex min-w-0 flex-col gap-4">
            {initialPostId ? (
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-medium text-base text-foreground">帖子详情</h2>
                <Link className="rounded text-sm text-violet-700 underline underline-offset-4 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600 dark:text-violet-300 dark:hover:text-violet-100" href="/forum">
                  返回全部帖子
                </Link>
              </div>
            ) : (
            <div className="glass flex flex-col gap-2 rounded-2xl p-2 xl:flex-row xl:items-center">
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {["全部", ...forumCategories].map((item) => (
                  <button
                    className={cn(
                      "relative shrink-0 rounded-xl px-3.5 py-1.5 text-[13px] transition-colors",
                      category === item ? "text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                    key={item}
                    onClick={() => setCategory(item)}
                    type="button"
                  >
                    {category === item ? (
                      <motion.span
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/80 via-violet-500/80 to-fuchsia-500/70 shadow-[0_6px_20px_-6px_oklch(0.6_0.22_290/0.8)]"
                        layoutId="forum-category"
                        transition={{ damping: 30, stiffness: 380, type: "spring" }}
                      />
                    ) : null}
                    <span className="relative">{item}</span>
                  </button>
                ))}
                <button
                  className={cn(
                    "relative shrink-0 rounded-xl px-3.5 py-1.5 text-[13px] transition-colors",
                    category === MINE_TAB ? "text-white" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setCategory(MINE_TAB)}
                  type="button"
                >
                  {category === MINE_TAB ? (
                    <motion.span
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/80 via-violet-500/80 to-fuchsia-500/70 shadow-[0_6px_20px_-6px_oklch(0.6_0.22_290/0.8)]"
                      layoutId="forum-category"
                      transition={{ damping: 30, stiffness: 380, type: "spring" }}
                    />
                  ) : null}
                  <span className="relative inline-flex items-center gap-1">
                    <UserRound className="size-3.5" />
                    {MINE_TAB}
                  </span>
                </button>
              </div>
              <div className="flex gap-2 xl:ml-auto">
                <div className="relative w-full xl:w-52">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    className={cn(fieldClass, "h-9 pl-9")}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                    placeholder="搜索活动、地点"
                    value={query}
                  />
                </div>
                <button
                  className="btn-cosmic h-9 shrink-0 rounded-xl px-4 text-[13px]"
                  onClick={handleSearch}
                  type="button"
                >
                  查找
                </button>
              </div>
            </div>
            )}

            {loading ? (
              <div className="grid gap-3">
                {[0, 1, 2].map((i) => (
                  <div className="glass h-[132px] animate-pulse rounded-2xl" key={i} />
                ))}
              </div>
            ) : loadError ? (
              <div className="glass rounded-2xl p-10 text-center text-[14px] text-muted-foreground">
                无法加载帖子，请刷新页面重试。
              </div>
            ) : posts.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-[14px] text-muted-foreground">
                {initialPostId ? "帖子不存在，或链接地址有误。" : category === MINE_TAB ? "你还没有发布过帖子，来发第一条吧。" : "这个分类下还没有帖子，来发第一条吧。"}
              </div>
            ) : (
              <div className="grid gap-3 pb-8">
                <AnimatePresence mode="popLayout">
                  {posts.map((post, index) => {
                    const style = CATEGORY_STYLE[post.category] ?? CATEGORY_STYLE["活动"];
                    return (
                      <motion.div
                        animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        initial={{ filter: "blur(6px)", opacity: 0, y: 16 }}
                        key={post.id}
                        layout
                        transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <SpotlightCard className="p-5" spotlight={style.glow}>
                          <div className="flex items-start gap-3.5">
                            <div
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-[15px] text-white shadow-[0_6px_18px_-6px_oklch(0.6_0.2_290/0.7)]",
                                style.avatar
                              )}
                            >
                              {post.author.slice(0, 1)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                                <span className={cn("rounded-full px-2 py-0.5 ring-1", style.badge)}>{post.category}</span>
                                {post.lostItemStatus ? (
                                  <span className={cn("rounded-full px-2 py-0.5 ring-1", post.lostItemStatus === "closed" ? "bg-slate-500/10 text-slate-700 ring-slate-500/25 dark:text-slate-300" : "bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300")}>
                                    {post.lostItemStatus === "closed" ? "已解决（发布者反馈）" : post.category === "招领" ? "待认领" : "寻找中"}
                                  </span>
                                ) : null}
                                <span className="text-foreground/80">{post.author}</span>
                                {post.mine ? (
                                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-200">
                                    我发布的
                                  </span>
                                ) : null}
                              </div>
                              <h2 className="mt-2 font-medium text-[16px] text-foreground">{post.title}</h2>
                              <p className="mt-1.5 whitespace-pre-wrap text-[14px] text-muted-foreground leading-7">
                                {post.body}
                              </p>
                              {post.eventTime || post.place ? (
                                <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
                                  {post.eventTime ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-foreground/80 ring-1 ring-border">
                                      <Clock3 className="size-3.5 text-violet-600 dark:text-violet-300" />
                                      {post.eventTime}
                                    </span>
                                  ) : null}
                                  {post.place ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-foreground/80 ring-1 ring-border">
                                      <MapPin className="size-3.5 text-cyan-600 dark:text-cyan-300" />
                                      {post.place}
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                                <button
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[12px] text-foreground/80 ring-1 ring-border transition-colors hover:text-foreground disabled:opacity-50"
                                  onClick={() => toggleComments(post)}
                                  type="button"
                                >
                                  <MessageCircle className="size-3.5 text-cyan-600 dark:text-cyan-300" />
                                  回复{(post.commentCount ?? 0) > 0 ? ` ${post.commentCount}` : ""}
                                </button>
                                {post.mine ? (
                                  <button
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-[12px] text-foreground/80 ring-1 ring-border transition-colors hover:text-foreground disabled:opacity-50"
                                    disabled={actionBusy === post.id}
                                    onClick={() => startEdit(post)}
                                    type="button"
                                  >
                                    <Pencil className="size-3.5 text-violet-600 dark:text-violet-300" />
                                    编辑
                                  </button>
                                ) : null}
                                {post.mine && post.lostItemId && post.lostItemStatus === "open" ? (
                                  <button
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[12px] text-emerald-800 ring-1 ring-emerald-500/25 transition-colors hover:bg-emerald-500/15 disabled:opacity-50 dark:text-emerald-300"
                                    disabled={actionBusy === post.id}
                                    onClick={() => handleResolve(post)}
                                    type="button"
                                  >
                                    <BadgeCheck className="size-3.5" />
                                    标记已解决
                                  </button>
                                ) : null}
                                {post.mine ? (
                                  <button
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[12px] text-rose-700 ring-1 ring-rose-500/25 transition-colors hover:bg-rose-500/15 disabled:opacity-50 dark:text-rose-300"
                                    disabled={actionBusy === post.id}
                                    onClick={() => handleDelete(post)}
                                    type="button"
                                  >
                                    <Trash2 className="size-3.5" />
                                    删除
                                  </button>
                                ) : null}
                              </div>
                              {expandedId === post.id ? (
                                <div className="mt-3 rounded-2xl bg-muted/50 p-3.5 ring-1 ring-border">
                                  {commentsLoading ? (
                                    <p className="text-[13px] text-muted-foreground">评论加载中…</p>
                                  ) : comments.length === 0 ? (
                                    <p className="text-[13px] text-muted-foreground">还没有评论，来说两句吧。</p>
                                  ) : (
                                    <div className="flex flex-col gap-2.5">
                                      {comments.map((comment) => {
                                        const parent = comment.parentId ? comments.find((item) => item.id === comment.parentId) : null;
                                        return (
                                          <div
                                            className={cn("flex flex-col gap-1", comment.parentId && "ml-4 border-l-2 border-border pl-2.5")}
                                            key={comment.id}
                                          >
                                            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                                              <span className="text-foreground/80">{comment.mine ? "我" : comment.author}</span>
                                              {parent ? <span className="text-muted-foreground/70">回复 {parent.mine ? "我" : parent.author}</span> : null}
                                              <span>{formatCommentTime(comment.createdAt)}</span>
                                              <button
                                                className="text-violet-700 transition-colors hover:underline dark:text-violet-300"
                                                onClick={() => setReplyTo(comment)}
                                                type="button"
                                              >
                                                回复
                                              </button>
                                            </div>
                                            <p className="whitespace-pre-wrap text-[13px] text-foreground/90 leading-6">{comment.body}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {replyTo ? (
                                    <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                                      <CornerDownRight className="size-3.5" />
                                      <span className="min-w-0 truncate">回复 {replyTo.mine ? "我" : replyTo.author}：{replyTo.body.slice(0, 20)}</span>
                                      <button
                                        aria-label="取消回复"
                                        className="shrink-0 transition-colors hover:text-foreground"
                                        onClick={() => setReplyTo(null)}
                                        type="button"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    </div>
                                  ) : null}
                                  <form
                                    className="mt-2.5 flex gap-2"
                                    onSubmit={(event) => {
                                      event.preventDefault();
                                      submitComment(post);
                                    }}
                                  >
                                    <input
                                      className={cn(fieldClass, "h-9 text-[13px]")}
                                      maxLength={500}
                                      onChange={(event) => setCommentBody(event.target.value)}
                                      placeholder={replyTo ? `回复 ${replyTo.mine ? "我" : replyTo.author}…` : "写下你的评论…"}
                                      value={commentBody}
                                    />
                                    <button
                                      className="btn-cosmic h-9 shrink-0 rounded-xl px-4 text-[13px] disabled:opacity-60"
                                      disabled={commentBusy || !commentBody.trim()}
                                      type="submit"
                                    >
                                      发送
                                    </button>
                                  </form>
                                </div>
                              ) : null}
                              {initialPostId && post.lostItemId ? <LostClaimPanel itemId={post.lostItemId} postId={post.id} /> : null}
                            </div>
                          </div>
                        </SpotlightCard>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* 发帖 */}
          <FadeIn className="lg:sticky lg:top-8" delay={0.3}>
            <form
              className="glass relative flex flex-col gap-3.5 overflow-hidden rounded-3xl p-5"
              id="forum-composer"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
                            <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/20 text-violet-700 ring-1 ring-border dark:text-violet-200">
                  <PenLine className="size-4" />
                </span>
                <h2 className="font-medium text-[15px]">{editingId ? "编辑我的帖子" : "发一条新帖"}</h2>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {forumCategories.map((item) => {
                  const style = CATEGORY_STYLE[item] ?? CATEGORY_STYLE["活动"];
                  const active = form.category === item;
                  return (
                    <button
                      className={cn(
                        "rounded-full px-3 py-1 text-[12px] ring-1 transition-all",
                        active ? style.badge : "text-muted-foreground ring-border hover:text-foreground"
                      )}
                      key={item}
                      onClick={() => update("category")(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <label className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                标题
                <input
                  className={fieldClass}
                  onChange={(event) => update("title")(event.target.value)}
                  placeholder="例如：周六篮球赛缺人"
                  value={form.title}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                  地点
                  <input
                    className={fieldClass}
                    onChange={(event) => update("place")(event.target.value)}
                    placeholder="体育馆、图书馆"
                    value={form.place}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                  时间
                  <input
                    className={fieldClass}
                    onChange={(event) => update("eventTime")(event.target.value)}
                    placeholder="周六 14:00"
                    value={form.eventTime}
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-[12px] text-muted-foreground">
                内容
                <textarea
                  className={cn(fieldClass, "h-auto min-h-28 resize-none py-2.5 leading-6")}
                  onChange={(event) => update("body")(event.target.value)}
                  placeholder="写清活动内容、人数或联系方式"
                  value={form.body}
                />
              </label>
              <button
                className="btn-cosmic mt-1 flex h-11 items-center justify-center gap-2 rounded-xl font-medium text-[14px] disabled:opacity-60"
                disabled={submitting}
                type="submit"
              >
                <Send className="size-4" />
                {submitting ? (editingId ? "保存中…" : "发布中…") : (editingId ? "保存修改" : "发布帖子")}
              </button>
              {editingId ? (
                <button
                  className="h-9 rounded-xl text-[13px] text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground"
                  onClick={cancelEdit}
                  type="button"
                >
                  取消编辑
                </button>
              ) : null}
            </form>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
