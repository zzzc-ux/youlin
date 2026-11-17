import { sql } from "drizzle-orm";
import { createDatabase } from "@/lib/db/client";
import type { ForumPost } from "./forum-shared";
import { ensureLostFoundStore } from "./lost-found";
import { redactPublicText } from "./privacy";

export type { ForumPost } from "./forum-shared";
export { forumCategories } from "./forum-shared";

const SEED_OWNER = "00000000-0000-4000-8000-000000000001";

let ready: Promise<void> | null = null;

function rowsOf(result: unknown): ForumPost[] {
  return (result as { rows?: ForumPost[] }).rows ?? [];
}

export async function ensureForum() {
  if (!ready) {
    ready = (async () => {
      await ensureLostFoundStore();
      const db = await createDatabase();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ForumPost" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "userId" uuid NOT NULL,
          "author" varchar(64) NOT NULL,
          "category" varchar(16) NOT NULL,
          "title" varchar(80) NOT NULL,
          "body" text NOT NULL,
          "place" varchar(80),
          "eventTime" varchar(80),
          "createdAt" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`ALTER TABLE "ForumPost" ADD COLUMN IF NOT EXISTS "lostItemId" uuid`);
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "ForumPost_one_lost_item" ON "ForumPost" ("lostItemId") WHERE "lostItemId" IS NOT NULL`);
      const existing = rowsOf(
        await db.execute(sql`SELECT "id" FROM "ForumPost" LIMIT 1`)
      );
      if (existing.length > 0) {
        return;
      }
      await db.execute(sql`
        INSERT INTO "ForumPost" ("userId", "author", "category", "title", "body", "place", "eventTime")
        VALUES
          (${SEED_OWNER}, '青年志愿者协会', '活动', '周五东区操场志愿服务', '整理共享单车和捡拾操场垃圾，预计一小时。完成可找辅导员登记志愿时长。', '东区操场', '周五 16:30'),
          (${SEED_OWNER}, '图书馆读者服务', '讲座', '学术规范读书会', '讨论如何引用文献和避免抄袭，适合准备课程论文的同学。', '图书馆报告厅', '周三 19:00'),
          (${SEED_OWNER}, '校篮球社', '社团', '院系篮球友谊赛', '每队 8 人，现场也可以当观众。请穿运动鞋。', '体育馆', '周六 14:00'),
          (${SEED_OWNER}, '学生会', '社团', '社团招新集中咨询', '摄影、书法、机器人和志愿者协会都在场，可以当场报名。', '大学生活动中心', '周四 12:30'),
          (${SEED_OWNER}, '高数课代表', '闲置', '出一套线性代数教材', '有笔记，九成新。只限校内面交，不邮寄。', '西区宿舍', '本周晚自习后')
      `);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export async function listForumPosts(): Promise<ForumPost[]> {
  await ensureForum();
  const db = await createDatabase();
  return rowsOf(
    await db.execute(sql`
      SELECT p."id", p."userId", p."author", p."category", p."title", p."body", p."place", p."eventTime", p."createdAt", p."lostItemId", l."status" AS "lostItemStatus"
      FROM "ForumPost" p LEFT JOIN "LostItem" l ON l."id" = p."lostItemId"
      ORDER BY p."createdAt" DESC
      LIMIT 80
    `)
  );
}

export async function getForumPostById(id: string): Promise<ForumPost | null> {
  await ensureForum();
  const db = await createDatabase();
  const posts = rowsOf(await db.execute(sql`
    SELECT p."id", p."userId", p."author", p."category", p."title", p."body", p."place", p."eventTime", p."createdAt", p."lostItemId", l."status" AS "lostItemStatus"
    FROM "ForumPost" p LEFT JOIN "LostItem" l ON l."id" = p."lostItemId" WHERE p."id" = ${id} LIMIT 1
  `));
  return posts[0] ?? null;
}

export async function getOpenForumPostForLostItem(itemId: string): Promise<ForumPost | null> {
  await ensureForum();
  const db = await createDatabase();
  const posts = rowsOf(await db.execute(sql`
    SELECT p."id", p."userId", p."author", p."category", p."title", p."body", p."place", p."eventTime", p."createdAt", p."lostItemId", l."status" AS "lostItemStatus"
    FROM "ForumPost" p JOIN "LostItem" l ON l."id" = p."lostItemId"
    WHERE p."lostItemId" = ${itemId} AND l."status" = 'open' ORDER BY p."createdAt" DESC LIMIT 1
  `));
  return posts[0] ?? null;
}

export async function createForumPost(input: {
  userId: string;
  author: string;
  category: string;
  title: string;
  body: string;
  place: string | null;
  eventTime: string | null;
  lostItemId?: string | null;
}): Promise<ForumPost> {
  await ensureForum();
  const db = await createDatabase();
  const isLostPost = Boolean(input.lostItemId) || input.category === "招领" || (input.category === "求助" && /(失物|寻物|丢|遗失|捡到|拾到)/.test(input.body));
  const title = isLostPost ? redactPublicText(input.title) : input.title;
  const body = isLostPost ? redactPublicText(input.body) : input.body;
  const author = isLostPost ? "校园同学" : input.author;
  const place = isLostPost && input.place ? redactPublicText(input.place) : input.place;
  const eventTime = isLostPost && input.eventTime ? redactPublicText(input.eventTime) : input.eventTime;
  const created = rowsOf(
    await db.execute(sql`
      INSERT INTO "ForumPost" ("userId", "author", "category", "title", "body", "place", "eventTime", "lostItemId")
      SELECT
        ${input.userId},
        ${author},
        ${input.category},
        ${title},
        ${body},
        ${place},
        ${eventTime},
        ${input.lostItemId ?? null}::uuid
      WHERE ${input.lostItemId ?? null}::uuid IS NULL OR EXISTS (
        SELECT 1 FROM "LostItem" WHERE "id" = ${input.lostItemId ?? null}::uuid AND "userId" = ${input.userId} AND "status" = 'open'
      )
      RETURNING "id", "userId", "author", "category", "title", "body", "place", "eventTime", "createdAt", "lostItemId"
    `)
  );
  const post = created[0];
  if (!post) {
    throw new Error("帖子没有发布成功");
  }
  return post;
}

const QUERY_FILLERS = [
  "请问",
  "帮我",
  "查一下",
  "查找",
  "搜索",
  "一下",
  "有没有",
  "有哪些",
  "有什么",
  "这周",
  "本周",
  "最近",
  "论坛",
  "帖子",
  "安排",
];

function searchTerms(query: string) {
  let text = query.trim();
  for (const filler of QUERY_FILLERS) {
    text = text.replaceAll(filler, " ");
  }
  return [...new Set(text.split(/\s+/).map((item) => item.trim()).filter((item) => item.length >= 2))];
}

export async function searchForumPosts(query: string, category?: string) {
  const posts = await listForumPosts();
  const text = query.trim();
  const terms = searchTerms(text);
  const asksForEvents =
    !category &&
    /(活动|讲座|社团|招新|这周|本周)/.test(text) &&
    terms.every((term) => ["活动", "讲座", "社团", "招新"].includes(term));
  const pool = posts.filter((post) => post.lostItemStatus !== "closed" && (!category || post.category === category));

  if (!text) {
    return pool.slice(0, 8);
  }

  if (asksForEvents) {
    return pool
      .filter((post) => post.category === "活动" || post.category === "讲座" || post.category === "社团")
      .slice(0, 8);
  }

  const ranked = pool
    .map((post) => {
      const blob = [post.title, post.body, post.place, post.eventTime, post.category, post.author]
        .filter(Boolean)
        .join(" ");
      let score = 0;
      if (category && post.category === category) {
        score += 2;
      }
      for (const word of terms) {
        if (blob.includes(word)) {
          score += word.length > 1 ? 3 : 1;
        }
      }
      if (blob.includes(text)) {
        score += 4;
      }
      return { post, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 8).map((item) => item.post);
}
