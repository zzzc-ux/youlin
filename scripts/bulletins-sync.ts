import { config } from "dotenv";

config({ path: ".env.local" });
config();

/**
 * 手动跑一次要闻同步：
 *   pnpm bulletins:sync
 *
 * 只写入 pending，不会直接出现在论坛上。
 * 审核请用 pnpm bulletins:review
 */
async function main() {
  const { resetBulletins, syncBulletins } = await import(
    "../lib/campus/bulletins-store"
  );

  if (process.argv.includes("--reset")) {
    const removed = await resetBulletins();
    console.log(`已清空 ${removed} 条旧数据，重新抓取。\n`);
  } else {
    console.log("开始同步要闻（已有的会自动跳过，加 --reset 可重抓）…\n");
  }

  const report = await syncBulletins();

  for (const item of report.categories) {
    const head = `${item.category}  ${item.keywords.join(" / ")}`;
    const tail = `可用 ${item.fetched} 条（滤掉 ${item.dropped}），新增 ${item.inserted}，重复 ${item.skipped}`;
    console.log(`${head}\n  ${tail}${item.error ? `  [${item.error}]` : ""}`);
  }

  console.log(
    `\n合计：新增 ${report.inserted} 条，跳过 ${report.skipped} 条，待审核 ${report.pending} 条`
  );
  if (report.pending > 0) {
    console.log("下一步：pnpm bulletins:review --approve-latest 3");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("同步失败：", error instanceof Error ? error.message : error);
    process.exit(1);
  });
