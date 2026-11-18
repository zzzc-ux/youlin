"use client";

import { PenLine, Search } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PRODUCT_NAME } from "@/lib/brand";
import { forumCategories } from "@/lib/campus/forum-shared";
import { cn } from "@/lib/utils";

export const ALL_TAB = "全部";
export const MINE_TAB = "我的帖子";
export const CATEGORY_TABS: string[] = [ALL_TAB, ...forumCategories, MINE_TAB];

export function CategoryTabs({
  active,
  className,
  onChange,
  tone = "bar",
}: {
  active: string;
  className?: string;
  onChange: (category: string) => void;
  tone?: "bar" | "inline";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      role="tablist"
    >
      {CATEGORY_TABS.map((tab) => (
        <button
          aria-selected={active === tab}
          className={cn(
            "relative shrink-0 transition-colors duration-150",
            tone === "bar" ? "py-3 text-[13px]" : "py-1.5 text-[13px]",
            active === tab
              ? "font-medium text-foreground"
              : "text-foreground/50 hover:text-foreground"
          )}
          key={tab}
          onClick={() => onChange(tab)}
          role="tab"
          type="button"
        >
          {tab}
          {active === tab ? (
            <span
              className={cn(
                "absolute inset-x-0 bg-primary",
                tone === "bar" ? "bottom-0 h-[2px]" : "-bottom-0.5 h-[2px]"
              )}
            />
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function ForumTopBar({
  category,
  onCategoryChange,
  onCreate,
  onQueryChange,
  onSearch,
  query,
}: {
  category: string;
  onCategoryChange: (category: string) => void;
  onCreate: () => void;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  query: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background">
      <div className="mx-auto flex h-12 w-full max-w-[1000px] items-center gap-4 px-4 md:px-8">
        <SidebarTrigger className="-ml-1.5 md:hidden" />
        <Link
          className="shrink-0 text-[14px] font-semibold tracking-[-0.01em] text-foreground"
          href="/forum"
        >
          {PRODUCT_NAME}
          <span className="ml-1.5 text-[12px] font-normal text-foreground/45">
            论坛
          </span>
        </Link>

        <div className="hidden min-w-0 md:block">
          <CategoryTabs active={category} onChange={onCategoryChange} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="relative hidden md:block">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-foreground/35"
              strokeWidth={1.5}
            />
            <input
              aria-label="搜索帖子"
              className="h-8 w-44 rounded-[6px] border border-border bg-card pr-2 pl-8 text-[12.5px] text-foreground outline-none transition-colors duration-150 placeholder:text-foreground/35 focus:border-primary/60"
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSearch();
                }
              }}
              placeholder="搜索帖子、地点"
              value={query}
            />
          </div>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={onCreate}
            type="button"
          >
            <PenLine className="size-3.5" strokeWidth={1.5} />
            发帖
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1000px] px-4 pb-2 md:hidden">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-foreground/35"
            strokeWidth={1.5}
          />
          <input
            aria-label="搜索帖子"
            className="h-9 w-full rounded-[6px] border border-border bg-card pr-2 pl-8 text-[13px] text-foreground outline-none placeholder:text-foreground/35 focus:border-primary/60"
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder="搜索帖子、地点"
            value={query}
          />
        </div>
      </div>
    </header>
  );
}
