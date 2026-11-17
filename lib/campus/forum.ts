import { sql } from "drizzle-orm";
import { createDatabase } from "@/lib/db/client";
import type { ForumPost } from "./forum-shared";
import { ensureLostFoundStore } from "./lost-found";
import { redactPublicText } from "./privacy";

export type { ForumPost } from "./forum-shared";
export { forumCategories } from "./forum-shared";

const SEED_OWNER = "00000000-0000-4000-8000-000000000001";

const readyByDb = new WeakMap<object, Promise<void>>();

function rowsOf(result: unknown): ForumPost[] {
  return (result as { rows?: ForumPost[] }).rows ?? [];
}

export async function ensureForum() {
  const db = await createDatabase();
  let ready = readyByDb.get(db);
  if (!ready) {
    ready = (async () => {
      await ensureLostFoundStore();
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
      readyByDb.delete(db);
      throw error;
    });
    readyByDb.set(db, ready);
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

const LOST_PATTERN = /(失物|寻物|丢|遗失|捡到|拾到)/;

function isLostLike(category: string, body: string, lostItemId?: string | null) {
  return Boolean(lostItemId) || category === "招领" || (category === "求助" && LOST_PATTERN.test(body));
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
  const lostPost = isLostLike(input.category, input.body, input.lostItemId);
  const title = lostPost ? redactPublicText(input.title) : input.title;
  const body = lostPost ? redactPublicText(input.body) : input.body;
  const author = lostPost ? "校园同学" : input.author;
  const place = lostPost && input.place ? redactPublicText(input.place) : input.place;
  const eventTime = lostPost && input.eventTime ? redactPublicText(input.eventTime) : input.eventTime;
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

export async function listForumPostsByUser(userId: string): Promise<ForumPost[]> {
  await ensureForum();
  const db = await createDatabase();
  return rowsOf(
    await db.execute(sql`
      SELECT p."id", p."userId", p."author", p."category", p."title", p."body", p."place", p."eventTime", p."createdAt", p."lostItemId", l."status" AS "lostItemStatus"
      FROM "ForumPost" p LEFT JOIN "LostItem" l ON l."id" = p."lostItemId"
      WHERE p."userId" = ${userId}
      ORDER BY p."createdAt" DESC
    `)
  );
}

export async function updateForumPost(input: {
  id: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  place: string | null;
  eventTime: string | null;
}): Promise<ForumPost | null> {
  await ensureForum();
  const existing = await getForumPostById(input.id);
  if (!existing || existing.userId !== input.userId) {
    return null;
  }
  const db = await createDatabase();
  const lostPost = isLostLike(input.category, input.body, existing.lostItemId);
  const title = lostPost ? redactPublicText(input.title) : input.title;
  const body = lostPost ? redactPublicText(input.body) : input.body;
  const author = lostPost ? "校园同学" : existing.author;
  const place = lostPost && input.place ? redactPublicText(input.place) : input.place;
  const eventTime = lostPost && input.eventTime ? redactPublicText(input.eventTime) : input.eventTime;
  await db.execute(sql`
    UPDATE "ForumPost"
    SET "category" = ${input.category}, "title" = ${title}, "body" = ${body},
        "place" = ${place}, "eventTime" = ${eventTime}, "author" = ${author}
    WHERE "id" = ${input.id} AND "userId" = ${input.userId}
  `);
  return getForumPostById(input.id);
}

export async function deleteForumPost(id: string, userId: string): Promise<boolean> {
  await ensureForum();
  const existing = await getForumPostById(id);
  if (!existing || existing.userId !== userId) {
    return false;
  }
  const db = await createDatabase();
  // 认领私信表由 claims 功能创建，可能尚不存在；先保证存在再清理关联数据
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "LostClaimThread" (
    "id" uuid PRIMARY KEY, "postId" uuid NOT NULL, "claimantId" uuid NOT NULL,
    "createdAt" timestamp NOT NULL DEFAULT now(), UNIQUE ("postId", "claimantId")
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "LostClaimMessage" (
    "id" uuid PRIMARY KEY, "threadId" uuid NOT NULL, "senderId" uuid NOT NULL,
    "body" text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`
    DELETE FROM "LostClaimMessage" m
    USING "LostClaimThread" t
    WHERE m."threadId" = t."id" AND t."postId" = ${id}
  `);
  await db.execute(sql`DELETE FROM "LostClaimThread" WHERE "postId" = ${id}`);
  // 评论表由评论功能创建，可能尚不存在；同样先保证存在再清理
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "ForumComment" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "postId" uuid NOT NULL, "userId" uuid NOT NULL, "author" varchar(64) NOT NULL,
    "body" text NOT NULL, "parentId" uuid, "createdAt" timestamp NOT NULL DEFAULT now()
  )`);
  await db.execute(sql`DELETE FROM "ForumComment" WHERE "postId" = ${id}`);
  await db.execute(sql`DELETE FROM "ForumPost" WHERE "id" = ${id} AND "userId" = ${userId}`);
  return true;
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

export async function searchForumPosts(query: string, category?: string, ownerId?: string) {
  const posts = await listForumPosts();
  const text = query.trim();
  const terms = searchTerms(text);
  const asksForEvents =
    !category &&
    /(活动|讲座|社团|招新|这周|本周)/.test(text) &&
    terms.every((term) => ["活动", "讲座", "社团", "招新"].includes(term));
  const pool = posts.filter((post) => (ownerId ? true : post.lostItemStatus !== "closed") && (!category || post.category === category) && (!ownerId || post.userId === ownerId));

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
