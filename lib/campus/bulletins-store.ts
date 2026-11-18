// biome-ignore-all lint/performance/noAwaitInLoops: 抓取和落库都必须串行——并发打同一接口会被限流，逐条插入才能拿到唯一键冲突结果
import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { createDatabase } from "@/lib/db/client";
import { type NewsHit, searchNews } from "@/lib/news/news-search";
import {
  BULLETIN_SAMPLE_SIZE,
  BULLETIN_WINDOW_DAYS,
  bulletinTitleFilters,
  bulletinTopics,
} from "./bulletin-topics";
import {
  type Bulletin,
  type BulletinCategory,
  bulletinCategories,
  groupBulletins,
  seedBulletins,
} from "./bulletins";

/**
 * 要闻栏的读写层。
 *
 * 几条约定：
 * 1. 同步进来的一律 `pending`，审核通过才进 `approved` 并上墙。
 * 2. 种子数据不进库，始终由代码提供，永远排在最前面。
 * 3. publishedAt 存「YYYY-MM-DD HH:mm」字符串（北京时间），
 *    这样字符串排序即时间排序，省掉时区和 Date 转换的坑。
 */

type BulletinStatus = "approved" | "pending" | "rejected";

type BulletinRow = {
  category: string;
  href: string | null;
  id: string;
  imageUrl: string | null;
  origin: string;
  publishedAt: string;
  source: string;
  title: string;
};

export type SyncCategoryReport = {
  category: BulletinCategory;
  /** 标题没过核心词过滤，被丢掉的条数 */
  dropped: number;
  error?: string;
  fetched: number;
  inserted: number;
  keywords: string[];
  skipped: number;
};

export type SyncReport = {
  categories: SyncCategoryReport[];
  inserted: number;
  fetched: number;
  pending: number;
  skipped: number;
};

const readyByDb = new WeakMap<object, Promise<void>>();

function rowsOf<T>(result: unknown): T[] {
  return (result as { rows?: T[] }).rows ?? [];
}

function fingerprint(category: string, title: string): string {
  const normalized = title.replace(
    /[\s　·、，,。.：:；;！!？?「」『』《》"'（）()\-—－]/g,
    ""
  );
  return createHash("sha1").update(`${category}|${normalized}`).digest("hex");
}

/** ISO 时间转北京时间的「YYYY-MM-DD HH:mm」 */
function beijingStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(date);
}

export async function ensureBulletinStore(): Promise<void> {
  const db = await createDatabase();
  let ready = readyByDb.get(db);
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "BulletinItem" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "category" varchar(8) NOT NULL,
          "title" text NOT NULL,
          "source" varchar(64) NOT NULL,
          "href" text,
          "imageUrl" text,
          "publishedAt" varchar(16) NOT NULL,
          "origin" varchar(16) NOT NULL DEFAULT 'people',
          "status" varchar(12) NOT NULL DEFAULT 'pending',
          "fingerprint" varchar(40) NOT NULL,
          "fetchedAt" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(
        sql`CREATE UNIQUE INDEX IF NOT EXISTS "BulletinItem_fingerprint" ON "BulletinItem" ("fingerprint")`
      );
      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS "BulletinItem_status_category" ON "BulletinItem" ("status", "category")`
      );
    })().catch((error) => {
      readyByDb.delete(db);
      throw error;
    });
    readyByDb.set(db, ready);
  }
  return ready;
}

function toBulletin(row: BulletinRow): Bulletin {
  return {
    category: row.category as BulletinCategory,
    href: row.href ?? undefined,
    id: row.id,
    image: row.imageUrl ?? undefined,
    origin: row.origin === "seed" ? "seed" : "people",
    publishedAt: row.publishedAt,
    source: row.source,
    title: row.title,
  };
}

/**
 * 组装要闻栏：种子在前、审核通过的新闻在后，按「第几条」对齐成组。
 * 追加而不是替换，组数会从 3 组涨到最多 12 组。
 */
export async function listBulletinBoard(seedSize = 3) {
  await ensureBulletinStore();
  const db = await createDatabase();
  const rows = rowsOf<BulletinRow>(
    await db.execute(sql`
      SELECT "id", "category", "title", "source", "href", "imageUrl", "publishedAt", "origin"
      FROM "BulletinItem"
      WHERE "status" = 'approved'
      ORDER BY "category" ASC, "publishedAt" DESC
    `)
  );

  const perCategory = new Map<BulletinCategory, Bulletin[]>();
  for (const category of bulletinCategories) {
    const seed = seedBulletins
      .filter((item) => item.category === category)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, seedSize);
    perCategory.set(category, seed);
  }
  for (const row of rows) {
    perCategory.get(row.category as BulletinCategory)?.push(toBulletin(row));
  }

  const sizes = [...perCategory.values()].map((list) => list.length);
  const size = Math.min(Math.max(seedSize, ...sizes), 12);
  const flat = bulletinCategories.flatMap(
    (category) => perCategory.get(category) ?? []
  );

  const [counts] = rowsOf<{ pending: string; approved: string }>(
    await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE "status" = 'pending') AS "pending",
        COUNT(*) FILTER (WHERE "status" = 'approved') AS "approved"
      FROM "BulletinItem"
    `)
  );

  return {
    counts: {
      approved: Number(counts?.approved ?? 0),
      pending: Number(counts?.pending ?? 0),
      seed: seedBulletins.length,
    },
    groups: groupBulletins(flat, size),
  };
}

/**
 * 清空已同步的条目，重新抓一遍用。
 * 种子数据不在库里，所以不受影响。
 */
export async function resetBulletins(): Promise<number> {
  await ensureBulletinStore();
  const db = await createDatabase();
  const rows = rowsOf<{ id: string }>(
    await db.execute(sql`DELETE FROM "BulletinItem" RETURNING "id"`)
  );
  return rows.length;
}

/**
 * 抓取并入库。只写 pending，不影响线上展示。
 * 单个关键词失败不拖垮整轮，按板块记录错误继续跑。
 */
export async function syncBulletins(): Promise<SyncReport> {
  await ensureBulletinStore();
  const db = await createDatabase();

  const categories: SyncCategoryReport[] = [];
  const collected: { category: BulletinCategory; hits: NewsHit[] }[] = [];

  for (const category of bulletinCategories) {
    const keywords = bulletinTopics[category];
    const filters = bulletinTitleFilters[category];
    const raw: NewsHit[] = [];
    let error: string | undefined;

    for (const keyword of keywords) {
      try {
        const result = await searchNews({
          count: BULLETIN_SAMPLE_SIZE,
          days: BULLETIN_WINDOW_DAYS,
          query: keyword,
        });
        raw.push(...result.hits);
      } catch (cause) {
        error = cause instanceof Error ? cause.message : "抓取失败";
      }
    }

    // 搜索是模糊匹配，标题里没有板块核心词的一律不要
    const hits = raw.filter((hit) =>
      filters.some((word) => hit.title.includes(word))
    );

    categories.push({
      category,
      dropped: raw.length - hits.length,
      error,
      fetched: hits.length,
      inserted: 0,
      keywords,
      skipped: 0,
    });
    collected.push({ category, hits });
  }

  const seenTitles = new Set<string>();
  let inserted = 0;
  let skipped = 0;

  for (const { category, hits } of collected) {
    const report = categories.find((item) => item.category === category);
    for (const hit of hits) {
      const title = hit.title.trim().slice(0, 120);
      const publishedAt = beijingStamp(hit.publishedAt);
      if (!(title && publishedAt)) {
        continue;
      }

      // 同一篇稿子只留一个板块，按 bulletinCategories 的顺序，思政优先
      const normalized = title.replace(/[\s　]/g, "");
      if (seenTitles.has(normalized)) {
        skipped += 1;
        if (report) {
          report.skipped += 1;
        }
        continue;
      }
      seenTitles.add(normalized);

      const key = fingerprint(category, title);
      const created = rowsOf<{ id: string }>(
        await db.execute(sql`
          INSERT INTO "BulletinItem" ("category", "title", "source", "href", "imageUrl", "publishedAt", "origin", "fingerprint")
          VALUES (${category}, ${title}, ${hit.source.slice(0, 64)}, ${hit.url}, ${hit.imageUrl ?? null}, ${publishedAt}, 'people', ${key})
          ON CONFLICT ("fingerprint") DO NOTHING
          RETURNING "id"
        `)
      );
      if (created.length > 0) {
        inserted += 1;
        if (report) {
          report.inserted += 1;
        }
      } else {
        skipped += 1;
        if (report) {
          report.skipped += 1;
        }
      }
    }
  }

  const [pendingRow] = rowsOf<{ count: string }>(
    await db.execute(
      sql`SELECT COUNT(*) AS "count" FROM "BulletinItem" WHERE "status" = 'pending'`
    )
  );
  const pending = Number(pendingRow?.count ?? 0);

  return {
    categories,
    fetched: categories.reduce((sum, item) => sum + item.fetched, 0),
    inserted,
    pending,
    skipped,
  };
}

export type PendingBulletin = {
  category: string;
  id: string;
  image: boolean;
  publishedAt: string;
  source: string;
  title: string;
};

export async function listPendingBulletins(): Promise<PendingBulletin[]> {
  await ensureBulletinStore();
  const db = await createDatabase();
  const rows = rowsOf<BulletinRow & { imageUrl: string | null }>(
    await db.execute(sql`
      SELECT "id", "category", "title", "source", "href", "imageUrl", "publishedAt", "origin"
      FROM "BulletinItem"
      WHERE "status" = 'pending'
      ORDER BY "publishedAt" DESC
    `)
  );
  return rows.map((row) => ({
    category: row.category,
    id: row.id,
    image: Boolean(row.imageUrl),
    publishedAt: row.publishedAt,
    source: row.source,
    title: row.title,
  }));
}

/**
 * 审核。ids 传 null 表示全部。
 * 支持传 id 前缀，省得每次复制 36 位 uuid。
 */
export async function setBulletinStatus(
  status: Exclude<BulletinStatus, "pending">,
  ids: string[] | null
): Promise<number> {
  await ensureBulletinStore();
  const db = await createDatabase();

  if (ids) {
    const pending = await listPendingBulletins();
    const targets = pending
      .filter((item) =>
        ids.some((prefix) => item.id.startsWith(prefix.toLowerCase()))
      )
      .map((item) => item.id);

    if (targets.length === 0) {
      return 0;
    }

    let changed = 0;
    for (const id of targets) {
      const rows = rowsOf<{ id: string }>(
        await db.execute(sql`
          UPDATE "BulletinItem" SET "status" = ${status}
          WHERE "id" = ${id}::uuid AND "status" = 'pending'
          RETURNING "id"
        `)
      );
      changed += rows.length;
    }
    return changed;
  }

  const rows = rowsOf<{ id: string }>(
    await db.execute(sql`
      UPDATE "BulletinItem" SET "status" = ${status}
      WHERE "status" = 'pending'
      RETURNING "id"
    `)
  );
  return rows.length;
}
