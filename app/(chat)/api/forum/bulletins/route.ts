import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { listBulletinBoard, syncBulletins } from "@/lib/campus/bulletins-store";

/**
 * 要闻栏数据接口。
 *
 * GET  返回三栏分组（种子在前、审核通过的新闻在后）
 * POST 触发一次抓取，只写 pending，不改变线上展示
 */

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const board = await listBulletinBoard();
    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `要闻加载失败：${error.message}`
            : "要闻加载失败",
      },
      { status: 500 }
    );
  }
}

const syncSchema = z.object({ action: z.literal("sync") });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = syncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
  }

  try {
    const report = await syncBulletins();
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? `同步失败：${error.message}` : "同步失败",
      },
      { status: 500 }
    );
  }
}
