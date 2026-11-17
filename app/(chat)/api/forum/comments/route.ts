import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { createForumComment, listForumComments } from "@/lib/campus/forum-comments";

const commentSchema = z.object({
  body: z.string().trim().min(1, "评论内容不能为空").max(500),
  parentId: z.uuid().optional(),
  postId: z.uuid(),
});

function publicComment<T extends { userId: string }>(comment: T, currentUserId: string) {
  const { userId, ...rest } = comment;
  return { ...rest, mine: userId === currentUserId };
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const postId = new URL(request.url).searchParams.get("postId");
  if (!postId || !z.uuid().safeParse(postId).success) {
    return NextResponse.json({ error: "帖子地址无效" }, { status: 400 });
  }

  const comments = await listForumComments(postId);
  return NextResponse.json({ comments: comments.map((comment) => publicComment(comment, session.user.id)) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = commentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "评论内容不能为空，且不超过 500 字" }, { status: 400 });
  }

  try {
    const comment = await createForumComment({
      author: session.user.email ?? "同学",
      body: parsed.data.body,
      parentId: parsed.data.parentId ?? null,
      postId: parsed.data.postId,
      userId: session.user.id,
    });
    return NextResponse.json({ comment: publicComment(comment, session.user.id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "评论失败" }, { status: 400 });
  }
}
