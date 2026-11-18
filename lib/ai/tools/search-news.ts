import { tool } from "ai";
import { z } from "zod";
import { searchNews as runNewsSearch } from "@/lib/news/news-search";

/**
 * 新闻搜索工具。
 *
 * 和 searchNotices 的区别要说清楚，否则模型会把两者混用：
 * searchNotices 查的是本机校园通知样本，searchNews 查的是人民网的外部资讯。
 */

const MAX_ITEMS = 10;

export type NewsSearchToolOutput =
  | {
      error: string;
      found: false;
    }
  | {
      found: boolean;
      news: {
        imageUrl?: string;
        publishedAt: string;
        section: string;
        source: string;
        summary: string;
        title: string;
        url: string;
      }[];
      note?: string;
      query: string;
    };

export function newsTools() {
  return {
    searchNews: tool({
      description:
        "搜索外部新闻资讯（来源为人民网及其报刊），返回标题、摘要、发布时间、来源和链接。用户问最近有什么新闻、某个话题的最新报道、时事热点时调用。注意：校园内部通知、失物、论坛帖子不要用这个工具。搜到的内容属于外部媒体，引用时需注明来源，不要把它当成校园官方信息。",
      execute: async ({ query, count, days }): Promise<NewsSearchToolOutput> => {
        try {
          const result = await runNewsSearch({
            count: count ?? 6,
            days,
            query,
          });

          const news = result.hits.slice(0, MAX_ITEMS).map((hit) => ({
            imageUrl: hit.imageUrl,
            publishedAt: hit.publishedAt,
            section: hit.section,
            source: hit.source,
            summary: hit.summary,
            title: hit.title,
            url: hit.url,
          }));

          return {
            found: news.length > 0,
            news,
            note:
              news.length === 0
                ? days
                  ? `最近 ${days} 天没有相关报道，可以放宽时间范围或换个关键词。`
                  : "没有找到相关报道，可以换个更具体的关键词。"
                : result.hits.length < result.rawCount
                  ? "已合并同一篇稿件的多个转载版本。"
                  : undefined,
            query: result.query,
          };
        } catch (error) {
          return {
            error:
              error instanceof Error
                ? `新闻搜索失败：${error.message}`
                : "新闻搜索失败",
            found: false,
          };
        }
      },
      inputSchema: z.object({
        count: z.number().int().min(1).max(MAX_ITEMS).optional(),
        days: z
          .number()
          .int()
          .min(1)
          .max(365)
          .optional()
          .describe("只看最近多少天的新闻，用户说“最近一周”就填 7"),
        query: z.string().trim().min(1).max(60),
      }),
    }),
  };
}
