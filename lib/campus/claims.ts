import { sql } from "drizzle-orm";
import { createDatabase } from "@/lib/db/client";
import { getForumPostById } from "./forum";

type Message = { id: string; threadId: string; role: "发布者" | "联系者"; body: string; createdAt: string };
type Thread = { id: string; messages: Message[] };

async function store() {
  const db = await createDatabase();
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "LostClaimThread" (
    "id" uuid PRIMARY KEY, "postId" uuid NOT NULL, "claimantId" uuid NOT NULL,
    "createdAt" timestamp NOT NULL DEFAULT now(), UNIQUE ("postId", "claimantId")
  )`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS "LostClaimMessage" (
    "id" uuid PRIMARY KEY, "threadId" uuid NOT NULL, "senderId" uuid NOT NULL,
    "body" text NOT NULL, "createdAt" timestamp NOT NULL DEFAULT now()
  )`);
  return db;
}

export async function getClaimConversations(postId: string, userId: string): Promise<{ isOwner: boolean; closed: boolean; threads: Thread[] }> {
  const post = await getForumPostById(postId);
  if (!post?.lostItemId) throw new Error("该帖子没有关联失物记录");
  const db = await store();
  const isOwner = post.userId === userId;
  const records = (await db.execute(sql`
    SELECT t."id" FROM "LostClaimThread" t WHERE t."postId" = ${postId}
      AND (${isOwner} OR t."claimantId" = ${userId}) ORDER BY t."createdAt" DESC
  `) as unknown as { rows: { id: string }[] }).rows;
  const threads = await Promise.all(records.map(async ({ id }) => {
    const messages = (await db.execute(sql`
      SELECT m."id", m."threadId", CASE WHEN m."senderId" = ${post.userId} THEN '发布者' ELSE '联系者' END AS "role", m."body", m."createdAt"
      FROM "LostClaimMessage" m WHERE m."threadId" = ${id} ORDER BY m."createdAt", m."id"
    `) as unknown as { rows: Message[] }).rows;
    return { id, messages };
  }));
  return { isOwner, closed: post.lostItemStatus !== "open", threads };
}

export async function sendClaimMessage(input: { postId: string; userId: string; threadId?: string; body: string }) {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 500) throw new Error("消息需为 1 至 500 字");
  const post = await getForumPostById(input.postId);
  if (!post?.lostItemId) throw new Error("该帖子没有关联失物记录");
  if (post.lostItemStatus !== "open") throw new Error("该记录已关闭，不能发送新消息");
  const db = await store();
  let threadId = input.threadId;
  if (!threadId) {
    if (post.userId === input.userId) throw new Error("请选择要回复的联系记录");
    const rows = (await db.execute(sql`
      INSERT INTO "LostClaimThread" ("id", "postId", "claimantId")
      VALUES (${crypto.randomUUID()}, ${input.postId}, ${input.userId})
      ON CONFLICT ("postId", "claimantId") DO UPDATE SET "postId" = EXCLUDED."postId"
      RETURNING "id"
    `) as unknown as { rows: { id: string }[] }).rows;
    threadId = rows[0]?.id;
  }
  if (!threadId) throw new Error("无法创建联系记录");
  const inserted = (await db.execute(sql`
    INSERT INTO "LostClaimMessage" ("id", "threadId", "senderId", "body")
    SELECT ${crypto.randomUUID()}, t."id", ${input.userId}, ${body}
    FROM "LostClaimThread" t JOIN "ForumPost" p ON p."id" = t."postId"
    JOIN "LostItem" l ON l."id" = p."lostItemId"
    WHERE t."id" = ${threadId} AND t."postId" = ${input.postId} AND l."status" = 'open'
      AND (t."claimantId" = ${input.userId} OR p."userId" = ${input.userId})
    RETURNING "id"
  `) as unknown as { rows: { id: string }[] }).rows;
  if (!inserted.length) throw new Error("无法发送：无权限或记录已关闭");
}
