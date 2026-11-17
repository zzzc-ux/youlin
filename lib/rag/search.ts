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
    // 无论长短都拆 2-4 字子串：避免“今天食堂”这类组合整体失配、丢掉“食堂”这个核心词
    const max = Math.min(4, part.length);
    for (let n = 2; n <= max; n += 1) {
      for (let i = 0; i + n <= part.length; i += 1) grams.add(part.slice(i, i + n));
    }
  }
  return [...grams];
}

// 从分块中抽取与查询词最匹配的问答片段（保持「问 + 答」成对，避免只返回问题）
function bestSnippet(
  content: string,
  keywords: { word: string; weight: number }[],
  maxLength = 500,
): { text: string; weight: number } {
  // 只在 Q 处切分：每段 = 一个问句 + 它的答案（A 行不能被单独切走）
  const segments = content
    .split(/(?=Q[:：])/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return {
      text: content.length > maxLength ? `${content.slice(0, maxLength)}…` : content,
      weight: 0,
    };
  }

  let best = "";
  let bestWeight = 0;
  let bestScore = 0;
  for (const segment of segments) {
    // 问句部分命中权重更高（用户提问最像问句）；每个关键词只计一次，避免长段落靠重复刷分
    const questionPart = segment.split(/A[:：]/)[0] ?? segment;
    const raw = keywords.reduce((sum, { word, weight }) => {
      if (weight <= 0 || !segment.includes(word)) return sum;
      return sum + weight * (questionPart.includes(word) ? 1.5 : 1);
    }, 0);
    if (raw <= 0) continue;
    // 长度轻度归一化：同等命中下更聚焦的问答对优先
    const score = raw / (1 + segment.length / 400);
    if (score > bestScore) {
      bestScore = score;
      bestWeight = raw;
      best = segment;
    }
  }

  if (!best) {
    // 完全无关键词命中（纯语义召回）：给开头一组问答作为上下文
    const head = segments.slice(0, 2).join(" ");
    return {
      text: head.length > maxLength ? `${head.slice(0, maxLength)}…` : head,
      weight: 0,
    };
  }
  return {
    text: best.length > maxLength ? `${best.slice(0, maxLength)}…` : best,
    weight: bestWeight,
  };
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

  const ranked = chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(queryVector, chunk.embedding);
      const snippet = bestSnippet(chunk.content, keywords);
      // 用「最佳片段的命中强度」而不是整块命中来排序：一个分块含多组问答，整块命中会串味
      const snippetScore =
        totalWeight > 0 ? Math.min((snippet.weight / (totalWeight * 1.5)), 1) : 0;
      return {
        doc: chunk.doc,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        snippet: snippet.text,
        score: vectorScore * 0.45 + snippetScore * 0.55,
      };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, k);
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
