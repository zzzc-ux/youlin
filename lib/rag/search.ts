import { createEmbeddingProvider } from "./embeddings";
import { getRagConfig } from "./config";
import { loadIndex, type RagChunkRecord } from "./store";

export interface RagSearchHit {
  doc: string;
  chunkIndex: number;
  content: string;
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

function topK(
  queryVector: number[],
  chunks: RagChunkRecord[],
  k: number,
): RagSearchHit[] {
  return chunks
    .map((chunk) => ({
      doc: chunk.doc,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      score: cosineSimilarity(queryVector, chunk.embedding),
    }))
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
  const hits = topK(queryVector, index.chunks, topKOverride ?? cfg.defaultTopK);

  return {
    query: trimmed,
    provider: index.provider,
    model: index.model,
    hits,
  };
}
