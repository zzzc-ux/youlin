import { tool } from "ai";
import { z } from "zod";
import { grabImage as runGrabImage } from "@/lib/media/image-grab";
import { searchImages as runImageSearch } from "@/lib/media/image-search";

/**
 * 图片搜索 + 抓取工具。
 *
 * 刻意不复用 MCP：这套项目跑在 Vercel 函数里，起不了 stdio 子进程；
 * 直接调用图源接口，少一层协议、少一个要运维的进程。
 *
 * 两个工具分开，是因为「搜」便宜、「抓」要占磁盘/带宽：
 * 让模型先给用户看候选，用户挑中了再落地，避免一次抓 20 张图。
 */

const MAX_IMAGES = 8;

export type ImageSearchToolOutput =
  | {
      error: string;
      found: false;
    }
  | {
      found: boolean;
      images: {
        id: string;
        imageUrl: string;
        isStock: boolean;
        pageUrl: string;
        source: string;
        thumbnailUrl: string;
        title: string;
      }[];
      note?: string;
      provider: string;
      query: string;
    };

export type GrabImageToolOutput =
  | { ok: true; bytes: number; contentType: string; url: string }
  | { ok: false; error: string };

export function imageTools() {
  return {
    grabImage: tool({
      description:
        "把一张图片从网络下载到本站并返回可访问地址。只能传 searchImages 返回过的 imageUrl。用户说“就要这张”“保存这张”“下载下来”时调用。不要一次抓很多张，用户没明确要的不要抓。",
      execute: async ({ imageUrl }): Promise<GrabImageToolOutput> => {
        try {
          const result = await runGrabImage(imageUrl);
          return {
            bytes: result.bytes,
            contentType: result.contentType,
            ok: true,
            url: result.url,
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : "图片抓取失败",
            ok: false,
          };
        }
      },
      inputSchema: z.object({
        imageUrl: z.string().trim().url().max(2000),
      }),
    }),
    searchImages: tool({
      description:
        "在网上搜索图片，返回候选图片列表（含直链和来源页）。用户要找图片、配图、看某个东西长什么样时调用。搜索结果不会自动下载，用户选中后需再调用 grabImage。校园内部信息（失物、通知、课程）不要用这个工具，用校园检索工具。",
      execute: async ({
        query,
        count,
        size,
      }): Promise<ImageSearchToolOutput> => {
        try {
          const result = await runImageSearch({
            count: count ?? MAX_IMAGES,
            query,
            size,
          });

          const images = result.hits.slice(0, MAX_IMAGES).map((hit, index) => ({
            id: `img-${index + 1}`,
            imageUrl: hit.imageUrl,
            isStock: hit.isStock,
            pageUrl: hit.pageUrl,
            source: hit.source,
            thumbnailUrl: hit.thumbnailUrl,
            title: hit.title,
          }));

          return {
            found: images.length > 0,
            images,
            note:
              images.length === 0
                ? "没有找到可用图片，可以换个更具体的关键词。"
                : result.stockCount > 0
                  ? `其中 ${result.stockCount} 张来自商用图库，转载需授权，请标注来源。`
                  : undefined,
            provider: result.provider,
            query: result.query,
          };
        } catch (error) {
          return {
            error:
              error instanceof Error
                ? `图片搜索失败：${error.message}`
                : "图片搜索失败",
            found: false,
          };
        }
      },
      inputSchema: z.object({
        count: z.number().int().min(1).max(MAX_IMAGES).optional(),
        query: z.string().trim().min(1).max(120),
        size: z.enum(["all", "large", "medium"]).optional(),
      }),
    }),
  };
}
