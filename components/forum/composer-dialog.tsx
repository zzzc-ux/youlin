"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ForumPost } from "@/lib/campus/forum-shared";
import { forumCategories } from "@/lib/campus/forum-shared";
import { cn } from "@/lib/utils";

type FormState = {
  body: string;
  category: string;
  eventTime: string;
  place: string;
  title: string;
};

const EMPTY: FormState = {
  body: "",
  category: "活动",
  eventTime: "",
  place: "",
  title: "",
};

const fieldClass =
  "w-full rounded-[6px] border border-border bg-background px-2.5 text-[13.5px] text-foreground outline-none transition-colors duration-150 placeholder:text-foreground/35 focus:border-primary/60";

export function ComposerDialog({
  onOpenChange,
  onSaved,
  open,
  post,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: (post: ForumPost) => void;
  open: boolean;
  post?: ForumPost | null;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (post) {
      setForm({
        body: post.body,
        category: post.category,
        eventTime: post.eventTime ?? "",
        place: post.place ?? "",
        title: post.title,
      });
      setShowDetail(Boolean(post.place || post.eventTime));
    } else {
      setForm(EMPTY);
      setShowDetail(false);
    }
    setError("");
    const timer = window.setTimeout(() => titleRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open, post]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    const isEdit = Boolean(post);
    if (form.title.trim().length < 2) {
      setError("标题至少写两个字，别人好判断要不要点开。");
      return;
    }
    if (form.body.trim().length < 2) {
      setError("内容还没写呢。");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(
        isEdit
          ? `${basePath}/api/forum?id=${encodeURIComponent(post?.id ?? "")}`
          : `${basePath}/api/forum`,
        {
          body: JSON.stringify({
            body: form.body.trim(),
            category: form.category,
            eventTime: form.eventTime.trim(),
            place: form.place.trim(),
            title: form.title.trim(),
          }),
          headers: { "Content-Type": "application/json" },
          method: isEdit ? "PATCH" : "POST",
        }
      );
      const data = (await response.json()) as {
        error?: string;
        post?: ForumPost;
      };
      if (!response.ok || !data.post) {
        setError(
          data.error ?? (isEdit ? "保存失败，请重试。" : "发布失败，请重试。")
        );
        return;
      }
      const redacted =
        data.post.body !== form.body.trim() ||
        data.post.title !== form.title.trim() ||
        (data.post.place ?? "") !== form.place.trim() ||
        (data.post.eventTime ?? "") !== form.eventTime.trim();
      toast.success(
        redacted
          ? "已保存，部分联系方式已自动隐去"
          : isEdit
            ? "已保存修改"
            : "已发到论坛"
      );
      onSaved(data.post);
      onOpenChange(false);
      setForm(EMPTY);
    } catch {
      setError(isEdit ? "保存失败，请检查网络。" : "发布失败，请检查网络。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30">
      <button
        aria-label="关闭发帖窗口"
        className="fixed inset-0 cursor-default"
        onClick={() => onOpenChange(false)}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-label={post ? "编辑帖子" : "发布新帖"}
        aria-modal="true"
        className="relative mx-auto mt-[6vh] mb-10 w-[calc(100%-2rem)] max-w-[600px] rounded-[10px] border border-border bg-card shadow-[0_8px_24px_-12px_rgba(0,0,0,0.2)]"
        role="dialog"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-[14px] font-medium text-foreground">
            {post ? "编辑帖子" : "发一条新帖"}
          </h2>
          <button
            aria-label="关闭"
            className="rounded-[4px] p-1 text-foreground/40 transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex flex-col gap-3.5 px-5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {forumCategories.map((item) => (
              <button
                className={cn(
                  "rounded-[4px] px-2.5 py-1 text-[12px] transition-colors duration-150",
                  form.category === item
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground/60 hover:text-foreground"
                )}
                key={item}
                onClick={() => update("category", item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <input
            className={cn(fieldClass, "h-9")}
            maxLength={80}
            onChange={(event) => update("title", event.target.value)}
            placeholder="标题：一句话说清是什么事"
            ref={titleRef}
            value={form.title}
          />

          <textarea
            className={cn(
              fieldClass,
              "min-h-[132px] resize-none py-2 leading-[1.7]"
            )}
            maxLength={2000}
            onChange={(event) => update("body", event.target.value)}
            placeholder="写清具体的时间、地点、有几个人、怎么联系。细节越多，回复越快。"
            value={form.body}
          />

          {showDetail ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-[11.5px] text-foreground/50">
                地点
                <input
                  className={cn(fieldClass, "h-8")}
                  maxLength={80}
                  onChange={(event) => update("place", event.target.value)}
                  placeholder="图书馆四楼"
                  value={form.place}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11.5px] text-foreground/50">
                时间
                <input
                  className={cn(fieldClass, "h-8")}
                  maxLength={80}
                  onChange={(event) => update("eventTime", event.target.value)}
                  placeholder="周五 19:00"
                  value={form.eventTime}
                />
              </label>
            </div>
          ) : (
            <button
              className="self-start text-[12px] text-foreground/45 transition-colors duration-150 hover:text-primary"
              onClick={() => setShowDetail(true)}
              type="button"
            >
              + 加一点细节（地点、时间）
            </button>
          )}

          {error ? (
            <p className="text-[12.5px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3">
          <span className="text-[11.5px] text-foreground/40">
            发完后也能在对话里问“这周有什么活动”
          </span>
          <div className="flex items-center gap-2">
            <button
              className="h-8 rounded-[6px] px-3 text-[12.5px] text-foreground/55 transition-colors duration-150 hover:text-foreground"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="inline-flex h-8 items-center rounded-[6px] bg-primary px-4 text-[12.5px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 disabled:opacity-60"
              disabled={submitting}
              onClick={submit}
              type="button"
            >
              {submitting ? "处理中…" : post ? "保存" : "发布"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
