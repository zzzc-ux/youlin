import { config } from "dotenv";

config({ path: ".env.local" });
config();

/**
 * 要闻审核（方案 B：不做审核页，命令行过一遍）。
 *
 *   pnpm bulletins:review                    列出待审核
 *   pnpm bulletins:review --approve-latest 3 每个板块通过最新的 3 条
 *   pnpm bulletins:review --approve-all      全部通过
 *   pnpm bulletins:review --reject-all       全部拒绝
 *   pnpm bulletins:review --approve 3f2a     按 id 前缀通过（可写多个）
 *   pnpm bulletins:review --reject 3f2a
 */
async function main() {
  const { listPendingBulletins, setBulletinStatus } = await import(
    "../lib/campus/bulletins-store"
  );

  // pnpm 在 -- 之后才转发参数，这里把占位的 -- 剔掉
  const argv = process.argv.slice(2).filter((item) => item !== "--");
  const flag = argv[0] ?? "--list";
  const ids = argv.slice(1);

  if (flag === "--approve-latest") {
    const perCategory = Math.max(1, Number(ids[0] ?? 3));
    const pending = await listPendingBulletins();
    const picked: string[] = [];
    const used = new Map<string, number>();
    for (const item of pending) {
      const count = used.get(item.category) ?? 0;
      if (count < perCategory) {
        picked.push(item.id);
        used.set(item.category, count + 1);
      }
    }
    const changed = await setBulletinStatus("approved", picked);
    console.log(
      `每个板块通过最新 ${perCategory} 条，共 ${changed} 条。剩余待审核 ${pending.length - changed} 条。`
    );
    return;
  }

  if (flag === "--approve-all" || flag === "--reject-all") {
    const status = flag === "--approve-all" ? "approved" : "rejected";
    const changed = await setBulletinStatus(status, null);
    console.log(
      `${status === "approved" ? "已通过" : "已拒绝"} ${changed} 条，其余没有变化。`
    );
    return;
  }

  if (flag === "--approve" || flag === "--reject") {
    if (ids.length === 0) {
      console.error("要指定 id 前缀，或者用 --approve-all / --reject-all");
      process.exit(1);
    }
    const changed = await setBulletinStatus(
      flag === "--approve" ? "approved" : "rejected",
      ids
    );
    console.log(`已处理 ${changed} 条（没匹配到的 id 会被忽略）。`);
    return;
  }

  const pending = await listPendingBulletins();
  if (pending.length === 0) {
    console.log("没有待审核的条目。先跑 pnpm bulletins:sync 抓一批。");
    return;
  }

  console.log(`待审核 ${pending.length} 条：\n`);
  for (const item of pending) {
    const id = item.id.slice(0, 8);
    const image = item.image ? "有图" : "无图";
    console.log(`${id}  [${item.category}] ${item.publishedAt}  ${image}`);
    console.log(`        ${item.title}`);
    console.log(`        来源：${item.source}\n`);
  }
  console.log("通过：pnpm bulletins:review --approve-latest 3");
  console.log("只过几条：pnpm bulletins:review --approve <id前缀> <id前缀>");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("执行失败：", error instanceof Error ? error.message : error);
    process.exit(1);
  });
