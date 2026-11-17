import { createEmbeddingProvider } from "./embeddings";
import { getRagConfig } from "./config";
import { loadIndex, type RagChunkRecord } from "./store";

export interface RagSearchHit {
  doc: string;
  chunkIndex: number;
  content: string;
  snippet: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 中文 2-4 字滑窗提取查询词，剔除高频虚词/疑问词
function keywordsOf(text: string): string[] {
  const cleaned = text
    .replace(/[的了呢吗啊呀吧是有没有怎么如何请问哪些什么]/g, " ")
    .replace(/[\s\p{P}]/gu, " ");
  const grams = new Set<string>();
  for (const part of cleaned.split(/\s+/).filter(Boolean)) {
    if (part.length <= 4) {
      if (part.length >= 2) grams.add(part);
      continue;
    }
    for (let n = 2; n <= 4; n += 1) {
      for (let i = 0; i + n <= part.length; i += 1) grams.add(part.slice(i, i + n));
    }
  }
  return [...grams];
}

// 关键词命中分：IDF × 词长加权（越稀有、越长的词贡献越大），避免“几点”“学校”这类短词稀释信号
function keywordScore(
  content: string,
  keywords: { word: string; weight: number }[],
  totalWeight: number,
): number {
  if (totalWeight === 0) return 0;
  const hit = keywords.reduce(
    (sum, { word, weight }) => sum + (weight > 0 && content.includes(word) ? weight : 0),
    0,
  );
  return Math.min(hit / totalWeight, 1);
}

// 从分块中抽取与查询词最匹配的问答片段（分块可能包含多组问答，取命中最强的一段）
function bestSnippet(
  content: string,
  keywords: { word: string; weight: number }[],
  maxLength = 400,
): string {
  const segments = content
    .split(/(?=[QA][:：])/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length <= 1) {
    return content.length > maxLength ? `${content.slice(0, maxLength)}…` : content;
  }
  let best = "";
  let bestScore = 0;
  for (const segment of segments) {
    // 按命中次数累加（上限 3 次），并对冗长段落做轻度归一化：越聚焦的问答对越可信
    const raw = keywords.reduce((sum, { word, weight }) => {
      if (weight <= 0) return sum;
      const occurrences = Math.min(segment.split(word).length - 1, 3);
      return sum + weight * occurrences;
    }, 0);
    const score = raw / (1 + segment.length / 300);
    if (score > bestScore) {
      bestScore = score;
      best = segment;
    }
  }
  if (!best) {
    // 完全无关键词命中（纯语义召回）：给开头一段作为上下文
    const head = segments.slice(0, 2).join("");
    return head.length > maxLength ? `${head.slice(0, maxLength)}…` : head;
  }
  return best.length > maxLength ? `${best.slice(0, maxLength)}…` : best;
}

function topK(
  queryVector: number[],
  query: string,
  chunks: RagChunkRecord[],
  k: number,
): RagSearchHit[] {
  const words = keywordsOf(query);
  const keywords = words.map((word) => {
    const df = chunks.reduce((n, chunk) => n + (chunk.content.includes(word) ? 1 : 0), 0);
    const idf = df === 0 ? 0 : Math.log(chunks.length / df);
    return { word, weight: idf * word.length };
  });
  const totalWeight = keywords.reduce((sum, item) => sum + item.weight, 0);

  return chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
      const kwScore = keywordScore(chunk.content, keywords, totalWeight);
      return {
        doc: chunk.doc,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        snippet: bestSnippet(chunk.content, keywords),
        score: vectorScore * 0.5 + kwScore * 0.5,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export interface RagSearchResult {
  query: string;
  provider: string;
  model: string;
  hits: RagSearchHit[];
}

export async function searchRag(
  query: string,
  topKOverride?: number,
): Promise<RagSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("查询内容不能为空");
  }

  const index = await loadIndex();
  if (!index || index.chunks.length === 0) {
    throw new Error("向量索引不存在或为空，请先运行建索引命令");
  }

  const cfg = getRagConfig();
  const provider = await createEmbeddingProvider();
  if (provider.dim !== index.dim || provider.model !== index.model) {
    throw new Error(
      `embedding 配置与索引不匹配（索引: ${index.model}/${index.dim} 维，当前: ${provider.model}/${provider.dim} 维），请重新建索引`,
    );
  }

  const [queryVector] = await provider.embed([trimmed]);
  const hits = topK(queryVector, trimmed, index.chunks, topKOverride ?? cfg.defaultTopK);

  return {
    query: trimmed,
    provider: index.provider,
    model: index.model,
    hits,
  };
}
