import { getRagConfig, type EmbeddingProviderName } from "./config";

export interface EmbeddingProvider {
  name: EmbeddingProviderName;
  model: string;
  dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

async function embedOllama(
  baseUrl: string,
  model: string,
  texts: string[],
): Promise<number[][]> {
  const res = await fetch(`${baseUrl}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama embedding 请求失败 (${res.status})：${body.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as { embeddings?: number[][] };
  if (!Array.isArray(data.embeddings)) {
    throw new Error("Ollama 响应缺少 embeddings 字段");
  }
  return data.embeddings;
}

async function embedOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  texts: string[],
): Promise<number[][]> {
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OpenAI 兼容 embedding 请求失败 (${res.status})：${body.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as {
    data?: Array<{ index?: number; embedding: number[] }>;
  };
  if (!Array.isArray(data.data)) {
    throw new Error("embedding 响应缺少 data 字段");
  }
  return data.data
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((d) => d.embedding);
}

export async function createEmbeddingProvider(): Promise<EmbeddingProvider> {
  const cfg = getRagConfig();

  if (cfg.provider === "openai" && !cfg.openai.apiKey) {
    throw new Error("EMBEDDING_PROVIDER=openai 但未配置 EMBEDDING_API_KEY");
  }

  const model =
    cfg.provider === "ollama" ? cfg.ollama.model : cfg.openai.model;

  // 用一条短文本探测维度，同时验证服务连通性
  const probe = await (cfg.provider === "ollama"
    ? embedOllama(cfg.ollama.baseUrl, cfg.ollama.model, ["dim"])
    : embedOpenAI(
        cfg.openai.baseUrl,
        cfg.openai.apiKey,
        cfg.openai.model,
        ["dim"],
      ));

  if (!probe[0] || probe[0].length === 0) {
    throw new Error("embedding 服务返回空向量");
  }

  return {
    name: cfg.provider,
    model,
    dim: probe[0].length,
    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];
      if (cfg.provider === "ollama") {
        return embedOllama(cfg.ollama.baseUrl, cfg.ollama.model, texts);
      }
      return embedOpenAI(
        cfg.openai.baseUrl,
        cfg.openai.apiKey,
        cfg.openai.model,
        texts,
      );
    },
  };
}
