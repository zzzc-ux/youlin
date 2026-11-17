// 建索引 CLI：pnpm exec tsx lib/rag/build-index.ts
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { buildIndex } from "./pipeline";

async function main() {
  console.log("开始建立 RAG 向量索引...");
  const result = await buildIndex();
  console.log(`✓ 索引构建完成`);
  console.log(`  提供商: ${result.provider} / 模型: ${result.model} / 维度: ${result.dim}`);
  console.log(`  文档数: ${result.documents.length}，总块数: ${result.totalChunks}`);
  for (const doc of result.documents) {
    console.log(`  - ${doc.name}：${doc.pages} 页 → ${doc.chunks} 块`);
  }
}

main().catch((error) => {
  console.error("✗ 索引构建失败:", error instanceof Error ? error.message : error);
  process.exit(1);
});
