import { sql } from "drizzle-orm";
import { createDatabase } from "@/lib/db/client";
import type { ForumComment } from "./forum-shared";
import { ensureForum, getForumPostById } from "./forum";

const readyByDb = new WeakMap<object, Promise<void>>();

function rowsOf(result: unknown): ForumComment[] {
  return (result as { rows?: ForumComment[] }).rows ?? [];
}

export async function ensureForumComments() {
  const db = await createDatabase();
  let ready = readyByDb.get(db);
  if (!ready) {
    ready = (async () => {
      await ensureForum();
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "ForumComment" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "postId" uuid NOT NULL,
          "userId" uuid NOT NULL,
          "author" varchar(64) NOT NULL,
          "body" text NOT NULL,
          "parentId" uuid,
          "createdAt" timestamp NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS "ForumComment_post" ON "ForumComment" ("postId")`);
    })().catch((error) => {
      readyByDb.delete(db);
      throw error;
    });
    readyByDb.set(db, ready);
  }
  return ready;
}

export async function listForumComments(postId: string): Promise<ForumComment[]> {
  await ensureForumComments();
  const db = await createDatabase();
  return rowsOf(
    await db.execute(sql`
      SELECT "id", "postId", "userId", "author", "body", "parentId", "createdAt"
      FROM "ForumComment" WHERE "postId" = ${postId}
      ORDER BY "createdAt" ASC
      LIMIT 200
    `)
  );
}

export async function countForumComments(postIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (postIds.length === 0) return counts;
  await ensureForumComments();
  const db = await createDatabase();
  const ids = sql.join(postIds.map((id) => sql`${id}`), sql`, `);
  const rows = (await db.execute(sql`
    SELECT "postId", COUNT(*)::int AS "count"
    FROM "ForumComment" WHERE "postId" IN (${ids})
    GROUP BY "postId"
  `)) as unknown as { rows: { postId: string; count: number }[] };
  for (const row of rows.rows ?? []) {
    counts.set(row.postId, row.count);
  }
  return counts;
}

export async function createForumComment(input: {
  postId: string;
  userId: string;
  author: string;
  body: string;
  parentId?: string | null;
}): Promise<ForumComment> {
  await ensureForumComments();
  const post = await getForumPostById(input.postId);
  if (!post) {
    throw new Error("帖子不存在或已删除");
  }
  const db = await createDatabase();
  let parentId = input.parentId ?? null;
  if (parentId) {
    const parents = rowsOf(
      await db.execute(sql`SELECT "id", "parentId" FROM "ForumComment" WHERE "id" = ${parentId} AND "postId" = ${input.postId} LIMIT 1`)
    );
    const parent = parents[0];
    if (!parent) {
      throw new Error("要回复的评论不存在");
    }
    // 只保留两级结构：回复一条回复时，挂到它的根评论下
    parentId = parent.parentId ?? parent.id;
  }
  const created = rowsOf(
    await db.execute(sql`
      INSERT INTO "ForumComment" ("postId", "userId", "author", "body", "parentId")
      VALUES (${input.postId}, ${input.userId}, ${input.author}, ${input.body}, ${parentId})
      RETURNING "id", "postId", "userId", "author", "body", "parentId", "createdAt"
    `)
  );
  const comment = created[0];
  if (!comment) {
    throw new Error("评论没有发布成功");
  }
  return comment;
}
