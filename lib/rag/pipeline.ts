import { readdir } from "node:fs/promises";
import path from "node:path";
import { createRandomId } from "./id";
import { chunkText } from "./chunk";
import { createEmbeddingProvider } from "./embeddings";
import { extractPdfPages, mergePageText } from "./pdf";
import { getRagConfig } from "./config";
import { saveIndex, type RagIndexFile } from "./store";

export interface BuildResult {
  documents: Array<{ name: string; chunks: number; pages: number }>;
  totalChunks: number;
  provider: string;
  model: string;
  dim: number;
}

export async function buildIndex(): Promise<BuildResult> {
  const cfg = getRagConfig();
  const entries = await readdir(cfg.documentsDir, { withFileTypes: true });
  const pdfFiles = entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"),
    )
    .map((entry) => entry.name)
    .sort();

  if (pdfFiles.length === 0) {
    throw new Error(`目录中没有 PDF：${cfg.documentsDir}`);
  }

  const provider = await createEmbeddingProvider();

  const documents: RagIndexFile["documents"] = [];
  const pendingChunks: Array<{
    id: string;
    doc: string;
    chunkIndex: number;
    content: string;
  }> = [];

  for (const name of pdfFiles) {
    const pages = await extractPdfPages(path.join(cfg.documentsDir, name));
    const text = mergePageText(pages);
    const chunks = chunkText(text, cfg.chunkSize, cfg.chunkOverlap);
    documents.push({ name, chunks: chunks.length, pages: pages.length });
    for (const chunk of chunks) {
      pendingChunks.push({
        id: createRandomId(),
        doc: name,
        chunkIndex: chunk.index,
        content: chunk.content,
      });
    }
  }

  if (pendingChunks.length === 0) {
    throw new Error("所有 PDF 均未提取到可用文本，无法建立索引");
  }

  const embeddings: number[][] = [];
  for (let i = 0; i < pendingChunks.length; i += cfg.batchSize) {
    const batch = pendingChunks
      .slice(i, i + cfg.batchSize)
      .map((chunk) => chunk.content);
    const vectors = await provider.embed(batch);
    if (vectors.length !== batch.length) {
      throw new Error(
        `embedding 数量不匹配：期望 ${batch.length}，返回 ${vectors.length}`,
      );
    }
    embeddings.push(...vectors);
  }

  const index: RagIndexFile = {
    version: 1,
    provider: provider.name,
    model: provider.model,
    dim: provider.dim,
    createdAt: new Date().toISOString(),
    documents,
    chunks: pendingChunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    })),
  };

  await saveIndex(index);

  return {
    documents,
    totalChunks: index.chunks.length,
    provider: index.provider,
    model: index.model,
    dim: index.dim,
  };
}
