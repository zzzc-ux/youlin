"use client";

import { useCallback, useEffect, useState } from "react";
import { BulletinBoard } from "@/components/forum/bulletin-board";
import { ComposerDialog } from "@/components/forum/composer-dialog";
import { ForumSidebar } from "@/components/forum/forum-sidebar";
import {
  ALL_TAB,
  CategoryTabs,
  ForumTopBar,
  MINE_TAB,
} from "@/components/forum/forum-top-bar";
import { PostRow } from "@/components/forum/post-row";
import type { ForumPost } from "@/lib/campus/forum-shared";
import type { CampusNotice } from "@/lib/campus/notices";
import { isToday } from "@/lib/forum/format";

const CATEGORY_HINT: Record<string, string> = {
  [ALL_TAB]: "有人在问，也有人在答。",
  招领: "捡到东西放这里，丢东西也放这里。",
  求助: "问一句不丢人，答一句也不费事。",
  活动: "要去的事都写在这里，写清时间地点，别人好安排。",
  社团: "招新、排练、约饭，都可以发。",
  讲座: "值得听的，和听完想吐槽的。",
  闲置: "校内面交，不邮寄，别转账。",
  [MINE_TAB]: "你发过的帖子都在这里，可以随时编辑或删除。",
};

function Skeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map((index) => (
        <div className="border-b border-border/60 py-4" key={index}>
          <div className="h-3 w-24 rounded-[3px] bg-muted" />
          <div className="mt-3 h-4 w-3/4 rounded-[3px] bg-muted" />
          <div className="mt-2.5 h-3 w-full rounded-[3px] bg-muted" />
          <div className="mt-2 h-3 w-2/3 rounded-[3px] bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ForumList({
  initialCategory,
  notices,
}: {
  initialCategory?: string;
  notices: CampusNotice[];
}) {
  const [category, setCategory] = useState(initialCategory ?? ALL_TAB);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async (nextCategory: string, nextQuery: string) => {
    const params = new URLSearchParams();
    if (nextCategory === MINE_TAB) {
      params.set("mine", "1");
    } else if (nextCategory !== ALL_TAB) {
      params.set("category", nextCategory);
    }
    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const response = await fetch(`${basePath}/api/forum?${params.toString()}`);
    if (!response.ok) {
      throw new Error("load failed");
    }
    const data = (await response.json()) as { posts: ForumPost[] };
    setPosts(data.posts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    load(category, submittedQuery)
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
  }, [category, submittedQuery, load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      await load(category, submittedQuery);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [category, submittedQuery, load]);

  const todayCount = posts.filter((post) => isToday(post.createdAt)).length;
  const hint = CATEGORY_HINT[category] ?? CATEGORY_HINT[ALL_TAB];

  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <ForumTopBar
        category={category}
        onCategoryChange={(next) => {
          setCategory(next);
          setSubmittedQuery("");
          setQuery("");
        }}
        onCreate={() => setComposerOpen(true)}
        onQueryChange={setQuery}
        onSearch={() => setSubmittedQuery(query)}
        query={query}
      />

      <div className="mx-auto w-full max-w-[1000px] px-4 pb-20 md:px-8">
        <div className="pt-7">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-foreground">
            校园论坛
          </h1>
          <p className="mt-0.5 text-[12px] text-foreground/50">
            共 {posts.length} 条 · 今天 {todayCount} 条新帖
          </p>
          <p className="mt-3 text-[13.5px] leading-[1.7] text-foreground/65">
            {hint}
          </p>
        </div>

        <div className="mt-5 border-b border-border/60 md:hidden">
          <CategoryTabs
            active={category}
            onChange={(next) => {
              setCategory(next);
              setSubmittedQuery("");
              setQuery("");
            }}
          />
        </div>

        <div className="mt-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_236px]">
          <div className="min-w-0 lg:pr-8">
            <BulletinBoard />

            {loading ? <Skeleton /> : null}

            {!loading && failed ? (
              <div className="py-16 text-center">
                <p className="text-[13.5px] text-foreground/55">
                  没拉到帖子，可能是网的问题。
                </p>
                <button
                  className="mt-2 text-[13px] text-primary hover:underline"
                  onClick={() => {
                    void refresh();
                  }}
                  type="button"
                >
                  刷新一下试试
                </button>
              </div>
            ) : null}

            {!loading && !failed && posts.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[13.5px] text-foreground/55">
                  {submittedQuery
                    ? `没找到「${submittedQuery}」，换个说法试试。`
                    : category === MINE_TAB
                      ? "你还没有发过帖子，来发第一条吧。"
                      : "这一栏还空着，等第一个开口的人。"}
                </p>
                <button
                  className="mt-2 text-[13px] text-primary hover:underline"
                  onClick={
                    submittedQuery
                      ? () => {
                          setQuery("");
                          setSubmittedQuery("");
                        }
                      : () => setComposerOpen(true)
                  }
                  type="button"
                >
                  {submittedQuery ? "看看全部" : "发一条"}
                </button>
              </div>
            ) : null}

            {!loading && !failed && posts.length > 0 ? (
              <>
                <div>
                  {posts.map((post) => (
                    <PostRow key={post.id} post={post} />
                  ))}
                </div>
                <p className="py-6 text-center text-[12px] text-foreground/35">
                  没有更多了
                </p>
              </>
            ) : null}
          </div>

          <aside className="hidden lg:block lg:border-l lg:border-border/60 lg:pt-6 lg:pl-6">
            <ForumSidebar notices={notices} posts={posts} />
          </aside>
        </div>
      </div>

      <ComposerDialog
        onOpenChange={setComposerOpen}
        onSaved={() => {
          void refresh();
        }}
        open={composerOpen}
      />
    </div>
  );
}
