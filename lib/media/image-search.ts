import "server-only";

/**
 * 图片搜索：不依赖任何 MCP / 第三方 API key。
 *
 * 默认走 Bing 图片（cn.bing.com，境内可直连），备选 DuckDuckGo（需海外出网）。
 * 两者的返回结构统一成 ImageSearchHit，上层工具与前端无需关心来源。
 */

export type ImageSearchProvider = "bing" | "duckduckgo";

export type ImageSearchHit = {
  /** 原图直链，抓取时优先使用 */
  imageUrl: string;
  /** 是否来自商用图库（有明确版权归属，展示时需标注来源） */
  isStock: boolean;
  /** 来源页面，用于标注出处 */
  pageUrl: string;
  /** 来源站点域名 */
  source: string;
  /** 缩略图直链，原图抓取失败时兜底展示 */
  thumbnailUrl: string;
  title: string;
};

export type ImageSearchOptions = {
  count?: number;
  query: string;
  /** 只在 Bing 生效：large 过滤掉小图 */
  size?: "all" | "large" | "medium";
};

export type ImageSearchResult = {
  /** 结果中商用图库的条数，供界面提示版权风险 */
  stockCount: number;
  hits: ImageSearchHit[];
  provider: ImageSearchProvider;
  query: string;
};

const MAX_COUNT = 30;
/** 多取几倍再排序截断：搜索结果里图库占比很高，按 count 取会导致可用结果太少 */
const OVERSAMPLE = 4;
const MAX_SAMPLE = 60;
const REQUEST_TIMEOUT_MS = 10_000;

const BROWSER_HEADERS: Record<string, string> = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
};

/**
 * 商用图库标记：这类图片有明确版权归属，抓取到本地再展示存在侵权风险。
 * 默认只做标记并排到末尾；设置 IMAGE_SEARCH_BLOCK_STOCK=1 可彻底过滤。
 */
const STOCK_PHOTO_HOSTS = [
  "699pic.com",
  "58pic.com",
  "tukuppt.com",
  "veer.com",
  "gettyimages",
  "shutterstock",
  "istockphoto",
  "dreamstime",
  "depositphotos",
  "photodune",
  "icphoto.cn",
  "hellorf.com",
  "zcool.com.cn",
  "huitu.com",
  "bigstockphoto",
  "123rf.com",
  "zhituwang.com",
  "88tph.com",
];

function envFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true";
}

function resolveProvider(): ImageSearchProvider {
  return process.env.IMAGE_SEARCH_PROVIDER?.trim().toLowerCase() ===
    "duckduckgo"
    ? "duckduckgo"
    : "bing";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isStockPhotoHost(host: string): boolean {
  return STOCK_PHOTO_HOSTS.some(
    (blocked) =>
      host === blocked || host.endsWith(`.${blocked}`) || host.includes(blocked)
  );
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

function normalizeCount(count: number | undefined): number {
  if (typeof count !== "number" || !Number.isFinite(count)) {
    return 10;
  }
  return Math.min(Math.max(Math.trunc(count), 1), MAX_COUNT);
}

function isUsableImageUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * 原生站点优先、图库靠后，再按需求截断。
 * 图库占比高但完全丢弃会让「樱花」这类通用词几乎无结果，因此只降权不删除。
 */
function rankHits(
  candidates: ImageSearchHit[],
  limit: number
): { hits: ImageSearchHit[]; stockCount: number } {
  const native = candidates.filter((hit) => !hit.isStock);
  const stock = candidates.filter((hit) => hit.isStock);
  const chosen = [...native, ...stock].slice(0, limit);

  return {
    hits: chosen,
    stockCount: chosen.filter((hit) => hit.isStock).length,
  };
}

type BingRawItem = {
  murl?: string;
  purl?: string;
  t?: string;
  turl?: string;
};

function parseBingHtml(html: string): ImageSearchHit[] {
  const pattern = /<a[^>]*class="[^"]*\biusc\b[^"]*"[^>]*\sm="([^"]+)"/g;
  const blockStock = envFlag("IMAGE_SEARCH_BLOCK_STOCK");
  const seen = new Set<string>();
  const hits: ImageSearchHit[] = [];

  for (
    let match = pattern.exec(html);
    match !== null;
    match = pattern.exec(html)
  ) {
    let raw: BingRawItem;
    try {
      raw = JSON.parse(decodeEntities(match[1])) as BingRawItem;
    } catch {
      continue;
    }

    const imageUrl = raw.murl?.trim() ?? "";
    if (!isUsableImageUrl(imageUrl) || seen.has(imageUrl)) {
      continue;
    }

    const source = hostOf(imageUrl) || hostOf(raw.purl ?? "");
    const stock = isStockPhotoHost(source);
    if (stock && blockStock) {
      continue;
    }

    seen.add(imageUrl);
    hits.push({
      imageUrl,
      isStock: stock,
      pageUrl: raw.purl ?? "",
      source,
      thumbnailUrl: raw.turl ?? imageUrl,
      title: (raw.t ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }

  return hits;
}

async function searchBing(
  options: ImageSearchOptions,
  sample: number
): Promise<ImageSearchHit[]> {
  const params = new URLSearchParams({
    count: String(sample),
    first: "0",
    mkt: "zh-CN",
    q: options.query,
  });

  if (options.size === "large") {
    params.set("qft", "+filterui:imagesize-large");
  } else if (options.size === "medium") {
    params.set("qft", "+filterui:imagesize-wallpaper");
  }

  const response = await fetch(
    `https://cn.bing.com/images/async?${params.toString()}`,
    {
      cache: "no-store",
      headers: { ...BROWSER_HEADERS, Referer: "https://cn.bing.com/" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(`Bing 图片搜索失败：HTTP ${response.status}`);
  }

  return parseBingHtml(await response.text());
}

type DuckDuckGoItem = {
  image?: string;
  source?: string;
  thumbnail?: string;
  title?: string;
  url?: string;
};

async function searchDuckDuckGo(
  options: ImageSearchOptions,
  sample: number
): Promise<ImageSearchHit[]> {
  const indexResponse = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(options.query)}&iax=images&ia=images`,
    {
      cache: "no-store",
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!indexResponse.ok) {
    throw new Error(`DuckDuckGo 初始化失败：HTTP ${indexResponse.status}`);
  }

  const html = await indexResponse.text();
  const vqd = /vqd=["']?([\d-]+)/.exec(html)?.[1];
  if (!vqd) {
    throw new Error("DuckDuckGo 未返回 vqd，可能触发了风控");
  }

  const params = new URLSearchParams({
    f: ",,,",
    l: "zh-cn",
    o: "json",
    p: "1",
    q: options.query,
    vqd,
  });

  const response = await fetch(
    `https://duckduckgo.com/i.js?${params.toString()}`,
    {
      cache: "no-store",
      headers: { ...BROWSER_HEADERS, Referer: "https://duckduckgo.com/" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(`DuckDuckGo 图片搜索失败：HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { results?: DuckDuckGoItem[] };
  const blockStock = envFlag("IMAGE_SEARCH_BLOCK_STOCK");
  const seen = new Set<string>();
  const hits: ImageSearchHit[] = [];

  for (const item of payload.results ?? []) {
    if (hits.length >= sample) {
      break;
    }
    const imageUrl = item.image?.trim() ?? "";
    if (!isUsableImageUrl(imageUrl) || seen.has(imageUrl)) {
      continue;
    }
    const source = hostOf(item.url ?? "") || hostOf(imageUrl);
    const stock = isStockPhotoHost(source);
    if (stock && blockStock) {
      continue;
    }
    seen.add(imageUrl);
    hits.push({
      imageUrl,
      isStock: stock,
      pageUrl: item.url ?? "",
      source,
      thumbnailUrl: item.thumbnail ?? imageUrl,
      title: (item.title ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
    });
  }

  return hits;
}

/**
 * 搜索图片。失败时抛错，由调用方降级或向用户说明，不返回半成品结果。
 */
export async function searchImages(
  options: ImageSearchOptions
): Promise<ImageSearchResult> {
  const query = options.query.trim();
  if (!query) {
    throw new Error("搜索关键词不能为空");
  }

  const limit = normalizeCount(options.count);
  const sample = Math.min(limit * OVERSAMPLE, MAX_SAMPLE);
  const preferred = resolveProvider();

  const run = async (target: ImageSearchProvider) =>
    target === "bing"
      ? await searchBing({ ...options, query }, sample)
      : await searchDuckDuckGo({ ...options, query }, sample);

  let provider = preferred;
  let candidates: ImageSearchHit[];

  try {
    candidates = await run(preferred);
  } catch (primaryError) {
    // 一个源挂了自动换另一个，两个都挂才抛错
    provider = preferred === "bing" ? "duckduckgo" : "bing";
    try {
      candidates = await run(provider);
    } catch (fallbackError) {
      const reason =
        primaryError instanceof Error
          ? primaryError.message
          : String(primaryError);
      throw new Error(
        `图片搜索失败（${preferred} 与 ${provider} 均不可用）：${reason}`,
        { cause: fallbackError }
      );
    }
  }

  const ranked = rankHits(candidates, limit);

  return {
    hits: ranked.hits,
    provider,
    query,
    stockCount: ranked.stockCount,
  };
}
