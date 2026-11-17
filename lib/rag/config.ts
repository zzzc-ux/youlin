import path from "node:path";

export type EmbeddingProviderName = "ollama" | "openai";

function envOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

export function getRagConfig() {
  const provider = envOr(process.env.EMBEDDING_PROVIDER, "ollama")
    .toLowerCase() as EmbeddingProviderName;

  if (provider !== "ollama" && provider !== "openai") {
    throw new Error(
      `EMBEDDING_PROVIDER 仅支持 ollama 或 openai，当前为: ${provider}`,
    );
  }

  return {
    provider,
    ollama: {
      baseUrl: envOr(process.env.OLLAMA_BASE_URL, "http://127.0.0.1:11434").replace(/\/$/, ""),
      model: envOr(process.env.OLLAMA_EMBED_MODEL, "nomic-embed-text"),
    },
    openai: {
      baseUrl: envOr(process.env.EMBEDDING_BASE_URL, "https://api.openai.com/v1").replace(/\/$/, ""),
      apiKey: process.env.EMBEDDING_API_KEY?.trim() ?? "",
      model: envOr(process.env.EMBEDDING_MODEL, "text-embedding-3-small"),
    },
    documentsDir: path.join(process.cwd(), "lib", "rag", "documents"),
    indexPath: path.join(process.cwd(), "data", "rag", "index.json"),
    chunkSize: 800,
    chunkOverlap: 120,
    batchSize: 16,
    defaultTopK: 5,
    // 相似度阈值：低于该值的检索结果视为不相关（可通过 RAG_MIN_SCORE 覆盖）
    minScore: Number.parseFloat(envOr(process.env.RAG_MIN_SCORE, "0.5")),
  } as const;
}
