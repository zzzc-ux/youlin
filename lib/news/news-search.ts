import "server-only";

/**
 * 新闻搜索：走人民网公开搜索接口，不接 MCP、不需要 API key。
 *
 * 选人民网的原因：JSON 接口稳定、境内直连、内容有明确出处与栏目归属，
 * 适合校园场景转载引用。代价是覆盖面只限人民网系（含《人民日报》）。
 */

export type NewsHit = {
  /** 封图，部分稿件没有 */
  imageUrl?: string;
  /** 发布时间，ISO 字符串 */
  publishedAt: string;
  /** 栏目路径，如「河北频道#科教」 */
  section: string;
  /** 来源媒体，如「人民网－《人民日报》」 */
  source: string;
  /** 摘要，已去掉搜索高亮标签 */
  summary: string;
  title: string;
  url: string;
};

export type NewsSearchOptions = {
  count?: number;
  /** 只要最近 N 天的新闻；不传则不限 */
  days?: number;
  query: string;
};

export type NewsSearchResult = {
  hits: NewsHit[];
  query: string;
  /** 去重前的原始条数，便于判断是不是搜索结果太集中 */
  rawCount: number;
};

const ENDPOINT = "http://search.people.cn/search-platform/front/search";
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_COUNT = 15;
const OVERSAMPLE = 3;

type PeopleRecord = {
  belongsName?: string;
  content?: string;
  displayTime?: number;
  imageUrl?: string;
  originName?: string;
  title?: string;
  url?: string;
};

function normalizeCount(count: number | undefined): number {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return 6;
  }
  return Math.min(Math.max(Math.trunc(count), 1), MAX_COUNT);
}

function decodeEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** 结果里带 <em> 高亮标签和实体，统一清成纯文本 */
function cleanText(input: string | undefined): string {
  if (!input) {
    return "";
  }
  return decodeEntities(input.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function toIso(timestamp: number | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return "";
  }
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/**
 * 同一篇稿子会以「人民网－人民日报」「人民网－《人民日报》」等多个版本返回，
 * 标题去掉高亮后完全一致，按标题去重是最省事且够用的办法。
 */
function dedupe(records: NewsHit[]): NewsHit[] {
  const seen = new Set<string>();
  const output: NewsHit[] = [];

  for (const record of records) {
    const key = record.title.replace(/[\s　]/g, "");
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(record);
  }

  return output;
}

function toHit(record: PeopleRecord): NewsHit | null {
  const title = cleanText(record.title);
  const url = record.url?.trim() ?? "";

  if (!title || !url) {
    return null;
  }

  const section = (record.belongsName ?? "").split("#").filter(Boolean)[0] ?? "";
  const image = record.imageUrl?.trim() ?? "";
  const hit: NewsHit = {
    publishedAt: toIso(record.displayTime),
    section: cleanText(section),
    source: cleanText(record.originName) || "人民网",
    summary: cleanText(record.content).slice(0, 220),
    title,
    url,
  };

  if (image.startsWith("http")) {
    hit.imageUrl = image;
  }

  return hit;
}

/**
 * 搜索新闻。接口失败时抛错，由工具层转成用户可读的提示。
 */
export async function searchNews(
  options: NewsSearchOptions
): Promise<NewsSearchResult> {
  const query = options.query.trim();
  if (!query) {
    throw new Error("搜索关键词不能为空");
  }

  const limit = normalizeCount(options.count);
  const sampleSize = Math.min(limit * OVERSAMPLE, 45);

  const response = await fetch(ENDPOINT, {
    body: JSON.stringify({
      hasContent: true,
      hasTitle: true,
      isFuzzy: true,
      key: query,
      limit: sampleSize,
      page: 1,
      // 2 = 按发布时间倒序；1 是相关度，会优先给出较早的深度稿
      sortType: 2,
      type: 0,
    }),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Referer: "http://search.people.cn/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`新闻搜索失败：HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    code?: string;
    data?: { records?: PeopleRecord[] };
  };

  if (payload.code !== "0") {
    throw new Error(`新闻搜索失败：接口返回 code=${payload.code ?? "未知"}`);
  }

  const records = payload.data?.records ?? [];
  const hits = records
    .map(toHit)
    .filter((hit): hit is NewsHit => hit !== null);

  const cutoff =
    typeof options.days === "number" && options.days > 0
      ? Date.now() - options.days * 86_400_000
      : null;

  const fresh = cutoff
    ? hits.filter((hit) => {
        const time = Date.parse(hit.publishedAt);
        return Number.isNaN(time) || time >= cutoff;
      })
    : hits;

  return {
    hits: dedupe(fresh).slice(0, limit),
    query,
    rawCount: records.length,
  };
}
