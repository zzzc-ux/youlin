import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getClaimConversations, sendClaimMessage } from "@/lib/campus/claims";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const postId = z.uuid().safeParse(new URL(request.url).searchParams.get("post"));
  if (!postId.success) return NextResponse.json({ error: "帖子地址无效" }, { status: 400 });
  try {
    return NextResponse.json(await getClaimConversations(postId.data, session.user.id));
  } catch {
    return NextResponse.json({ error: "无法查看联系记录" }, { status: 404 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const input = z.object({ postId: z.uuid(), threadId: z.uuid().optional(), body: z.string().trim().min(1).max(500) }).safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "消息需为 1 至 500 字" }, { status: 400 });
  try {
    await sendClaimMessage({ ...input.data, userId: session.user.id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "发送失败" }, { status: 400 });
  }
}
