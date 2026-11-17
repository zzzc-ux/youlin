import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createForumPost,
  deleteForumPost,
  forumCategories,
  getForumPostById,
  listForumPosts,
  listForumPostsByUser,
  searchForumPosts,
  updateForumPost,
} from "@/lib/campus/forum";
import { closeOwnItem } from "@/lib/campus/lost-found";

const postSchema = z.object({
  body: z.string().trim().min(2).max(2000),
  category: z.enum(forumCategories),
  eventTime: z.string().trim().max(80).optional(),
  place: z.string().trim().max(80).optional(),
  title: z.string().trim().min(2).max(80),
});

const resolveSchema = z.object({ action: z.literal("resolve") });

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
    return NextResponse.json({ posts: post ? [publicPost(post, session.user.id)] : [] });
  }
  const query = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const mineOnly = searchParams.get("mine") === "1";
  const posts = mineOnly
    ? query || category
      ? await searchForumPosts(query, category || undefined, session.user.id)
      : await listForumPostsByUser(session.user.id)
    : query || category
      ? await searchForumPosts(query, category || undefined)
      : await listForumPosts();

  return NextResponse.json({ posts: posts.map((post) => publicPost(post, session.user.id)) });
}

function publicPost<T extends { userId: string }>(post: T, currentUserId: string) {
  const { userId, ...rest } = post;
  return { ...rest, mine: userId === currentUserId };
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

  return NextResponse.json({ post: publicPost(post, session.user.id) });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("id");
  if (!postId || !z.uuid().safeParse(postId).success) {
    return NextResponse.json({ error: "帖子地址无效" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  const resolve = resolveSchema.safeParse(body);
  if (resolve.success) {
    const post = await getForumPostById(postId);
    if (!post || post.userId !== session.user.id) {
      return NextResponse.json({ error: "只能操作自己发布的帖子" }, { status: 403 });
    }
    if (!post.lostItemId) {
      return NextResponse.json({ error: "该帖子没有关联失物记录" }, { status: 400 });
    }
    const closed = await closeOwnItem(session.user.id, null, post.lostItemId);
    if (!closed) {
      return NextResponse.json({ error: "失物记录已是关闭状态" }, { status: 400 });
    }
    const updated = await getForumPostById(postId);
    return NextResponse.json({ post: updated ? publicPost(updated, session.user.id) : null });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "请把标题和内容写完整" }, { status: 400 });
  }

  const updated = await updateForumPost({
    body: parsed.data.body,
    category: parsed.data.category,
    eventTime: parsed.data.eventTime || null,
    id: postId,
    place: parsed.data.place || null,
    title: parsed.data.title,
    userId: session.user.id,
  });
  if (!updated) {
    return NextResponse.json({ error: "只能修改自己发布的帖子" }, { status: 403 });
  }

  return NextResponse.json({ post: publicPost(updated, session.user.id) });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("id");
  if (!postId || !z.uuid().safeParse(postId).success) {
    return NextResponse.json({ error: "帖子地址无效" }, { status: 400 });
  }

  const removed = await deleteForumPost(postId, session.user.id);
  if (!removed) {
    return NextResponse.json({ error: "只能删除自己发布的帖子" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
