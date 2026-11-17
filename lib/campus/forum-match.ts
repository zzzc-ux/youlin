import { generateText } from "ai";
import { getLanguageModel, hasModelProvider } from "@/lib/ai/providers";
import type { ForumPost } from "./forum-shared";

const MAX_CANDIDATES = 40;
const MAX_MATCHES = 3;

// 从模型输出中提取帖子序号数组，兼容输出 [1,2] 或 [{"index":1}] 以及夹带解释文字的情况
function parseIndices(raw: string): number[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as unknown[];
    if (!Array.isArray(parsed)) return [];
    const indices = parsed
      .map((item) => {
        if (typeof item === "number") return item;
        if (item && typeof item === "object") {
          const value = (item as Record<string, unknown>).index ?? (item as Record<string, unknown>).序号;
          return typeof value === "number" ? value : Number.parseInt(String(value), 10);
        }
        return Number.NaN;
      })
      .filter((n) => Number.isInteger(n) && n >= 1);
    return [...new Set(indices)];
  } catch {
    return [];
  }
}

/**
 * 用 LLM 从候选论坛帖子中做语义匹配，返回按相关度排序的帖子子集。
 * 没有可用模型、候选为空或模型输出无法解析时返回空数组，由调用方回退到关键词匹配。
 */
export async function matchForumPostsWithLLM(query: string, candidates: ForumPost[]): Promise<ForumPost[]> {
  if (!hasModelProvider() || candidates.length === 0) return [];

  const pool = candidates.slice(0, MAX_CANDIDATES);
  const list = pool
    .map((post, i) => {
      const meta = [post.place, post.eventTime].filter(Boolean).join("，");
      return `${i + 1}. 【${post.category}】${post.title}${meta ? `（${meta}）` : ""}：${post.body.slice(0, 120)}`;
    })
    .join("\n");

  const { text } = await generateText({
    model: getLanguageModel("forum-match") as Parameters<typeof generateText>[0]["model"],
    prompt: `你是校园论坛的检索助手。根据用户的需求，从下面的候选帖子中挑选最相关的帖子（最多 ${MAX_MATCHES} 条）。
只输出一个 JSON 数组，元素为帖子序号，按相关度从高到低排列，例如 [2, 5]。不要输出任何解释或其他文字。
如果没有帖子与需求相关，输出 []。

用户需求：${query}

候选帖子：
${list}`,
  });

  const indices = parseIndices(text);
  return indices
    .map((i) => pool[i - 1])
    .filter((post): post is ForumPost => Boolean(post))
    .slice(0, MAX_MATCHES);
}
