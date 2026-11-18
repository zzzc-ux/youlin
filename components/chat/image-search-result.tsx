"use client";

import { ImageOff } from "lucide-react";
import { type SyntheticEvent, useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export type ImageSearchItem = {
  id: string;
  imageUrl: string;
  isStock: boolean;
  pageUrl: string;
  source: string;
  thumbnailUrl: string;
  title: string;
};

/**
 * 搜索结果网格。
 *
 * 这里刻意使用原生 <img> 而不是 next/image：图片域名来自实时搜索结果，
 * 无法预先写入 next.config.ts 的 remotePatterns 白名单。
 * referrerPolicy="no-referrer" 用于绕过部分站点的防盗链。
 */
export function ImageSearchGrid({
  images,
  note,
  query,
}: {
  images: ImageSearchItem[];
  note?: string;
  query: string;
}) {
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  /**
   * 缩略图挂了先直接换成原图（改 DOM 比再存一份 state 便宜），
   * 原图也挂了才标记为加载失败。
   */
  const handleImageError = useCallback(
    (event: SyntheticEvent<HTMLImageElement>) => {
      const { currentTarget: image } = event;
      const { dataset } = image;

      if (dataset.original && dataset.fallback !== "1") {
        dataset.fallback = "1";
        image.src = dataset.original;
        return;
      }

      const id = dataset.imageId ?? "";
      setBroken((prev) => ({ ...prev, [id]: true }));
    },
    []
  );

  if (images.length === 0) {
    return (
      <div className="glass w-fit rounded-xl px-3.5 py-2.5 text-[13px] text-foreground/70">
        没有搜到可用图片{note ? `：${note}` : ""}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[560px] space-y-2">
      <div className="flex items-baseline gap-2 text-[12px] text-foreground/55">
        <span className="font-medium text-foreground/75">
          「{query}」的图片
        </span>
        <span>{images.length} 张</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((item) => (
          <a
            className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-foreground/5 ring-1 ring-black/10 transition hover:ring-violet-400/60 dark:ring-white/15"
            href={item.pageUrl || item.imageUrl}
            key={item.id}
            rel="noreferrer noopener"
            target="_blank"
          >
            {broken[item.id] ? (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-foreground/40">
                <ImageOff className="size-5" />
                <span className="text-[11px]">加载失败</span>
              </span>
            ) : (
              // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError 仅用于图片加载失败兜底
              // biome-ignore lint/performance/noImgElement: 搜索结果的图片域名是动态的，无法加入 next/image 白名单
              <img
                alt={item.title || query}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                data-image-id={item.id}
                data-original={
                  item.thumbnailUrl && item.thumbnailUrl !== item.imageUrl
                    ? item.imageUrl
                    : ""
                }
                loading="lazy"
                onError={handleImageError}
                referrerPolicy="no-referrer"
                src={item.thumbnailUrl || item.imageUrl}
              />
            )}
            {item.isStock ? (
              <span className="absolute top-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/85">
                图库
              </span>
            ) : null}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-[11px] text-white/90 opacity-0 transition group-hover:opacity-100">
              <span className="line-clamp-1">{item.title || item.source}</span>
            </span>
          </a>
        ))}
      </div>

      {note ? <p className="text-[11px] text-foreground/45">{note}</p> : null}
    </div>
  );
}

/**
 * 抓取完成后的确认卡片：证明图真的落到本站了，而不是还在第三方站点。
 */
export function GrabbedImageCard({
  bytes,
  url,
}: {
  bytes: number;
  url: string;
}) {
  return (
    <div className="glass flex w-fit max-w-[320px] items-center gap-3 rounded-xl p-2 pr-3.5">
      {/* biome-ignore lint/performance/noImgElement: 落地图地址可来自 Blob 或本地 uploads，形态不固定 */}
      <img
        alt="已保存的图片"
        className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/15"
        src={url}
      />
      <div className={cn("min-w-0 text-[12px] leading-tight")}>
        <p className="font-medium text-foreground/85">已保存到本站</p>
        <p className="truncate text-foreground/50">
          {url} · {Math.max(1, Math.round(bytes / 1024))}KB
        </p>
      </div>
    </div>
  );
}
