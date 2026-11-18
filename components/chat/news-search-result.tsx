"use client";

import { useState } from "react";
import { formatRelativeTime } from "@/lib/forum/format";

export type NewsSearchItem = {
  imageUrl?: string;
  publishedAt: string;
  section: string;
  source: string;
  summary: string;
  title: string;
  url: string;
};

/**
 * 新闻结果列表。
 *
 * 和图片网格一样用原生 <img>：封面来自人民网各频道，域名不固定，
 * 无法预置到 next.config.ts 的 remotePatterns 白名单。
 */
export function NewsSearchList({
  note,
  news,
  query,
}: {
  note?: string;
  news: NewsSearchItem[];
  query: string;
}) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  if (news.length === 0) {
    return (
      <div className="glass w-fit rounded-xl px-3.5 py-2.5 text-[13px] text-foreground/70">
        没有找到相关报道{note ? `：${note}` : ""}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[560px] space-y-2">
      <div className="flex items-baseline gap-2 text-[12px] text-foreground/55">
        <span className="font-medium text-foreground/75">
          「{query}」的报道
        </span>
        <span>{news.length} 条</span>
      </div>

      <div className="glass divide-y divide-black/[0.06] overflow-hidden rounded-xl dark:divide-white/10">
        {news.map((item) => (
          <a
            className="group flex gap-3 p-3 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            href={item.url}
            key={item.url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {item.imageUrl && !broken[item.url] ? (
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError 仅用于隐藏失效封面
              // biome-ignore lint/performance/noImgElement: 新闻封面域名来自外部频道，无法加入 next/image 白名单
              <img
                alt=""
                className="size-16 shrink-0 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/15"
                loading="lazy"
                onError={() =>
                  setBroken((prev) => ({ ...prev, [item.url]: true }))
                }
                referrerPolicy="no-referrer"
                src={item.imageUrl}
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[13.5px] font-medium leading-snug text-foreground/90 group-hover:text-foreground">
                {item.title}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-foreground/55">
                {item.summary}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-foreground/45">
                <span className="truncate">{item.source}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0">
                  {formatRelativeTime(item.publishedAt)}
                </span>
              </p>
            </div>
          </a>
        ))}
      </div>

      {note ? <p className="text-[11px] text-foreground/45">{note}</p> : null}
    </div>
  );
}
