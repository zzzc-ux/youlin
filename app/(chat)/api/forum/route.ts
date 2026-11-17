import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createForumPost,
  forumCategories,
  getForumPostById,
  listForumPosts,
  searchForumPosts,
} from "@/lib/campus/forum";

const postSchema = z.object({
  body: z.string().trim().min(2).max(2000),
  category: z.enum(forumCategories),
  eventTime: z.string().trim().max(80).optional(),
  place: z.string().trim().max(80).optional(),
  title: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("id");
  if (postId !== null) {
    if (!z.uuid().safeParse(postId).success) {
      return NextResponse.json({ error: "帖子地址无效" }, { status: 400 });
    }
    const post = await getForumPostById(postId);
    return NextResponse.json({ posts: post ? [publicPost(post)] : [] });
  }
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const posts =
    query || category
      ? await searchForumPosts(query, category || undefined)
      : await listForumPosts();

  return NextResponse.json({ posts: posts.map(publicPost) });
}

function publicPost<T extends { userId: string }>(post: T): Omit<T, "userId"> {
  const { userId: _userId, ...rest } = post;
  return rest;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请把标题和内容写完整" }, { status: 400 });
  }

  const post = await createForumPost({
    author: session.user.email ?? "同学",
    body: parsed.data.body,
    category: parsed.data.category,
    eventTime: parsed.data.eventTime || null,
    place: parsed.data.place || null,
    title: parsed.data.title,
    userId: session.user.id,
  });

  return NextResponse.json({ post: publicPost(post) });
}
