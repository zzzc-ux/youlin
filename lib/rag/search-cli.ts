// 检索测试 CLI：pnpm exec tsx lib/rag/search-cli.ts "你的问题"
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

import { searchRag } from "./search";

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error("用法: pnpm exec tsx lib/rag/search-cli.ts \"查询内容\"");
    process.exit(1);
  }

  const result = await searchRag(query, 5);
  console.log(`查询: ${result.query}`);
  console.log(`向量模型: ${result.provider} / ${result.model}`);
  console.log("---");
  for (const [i, hit] of result.hits.entries()) {
    console.log(
      `[${i + 1}] 相似度 ${hit.score.toFixed(4)} | ${hit.doc} #块${hit.chunkIndex}`,
    );
    console.log(`    ${hit.content.slice(0, 120)}${hit.content.length > 120 ? "..." : ""}`);
  }
}

main().catch((error) => {
  console.error("✗ 检索失败:", error instanceof Error ? error.message : error);
  process.exit(1);
});
