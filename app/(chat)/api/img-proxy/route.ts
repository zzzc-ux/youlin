import { NextResponse } from "next/server";

/**
 * 图片代理。
 *
 * 为什么要它：人民网封面是 http://hb.people.com.cn/... 这种地址，
 * 协议是 http、域名也不在 next.config.ts 的 remotePatterns 里，
 * 直接交给 next/image 会报错，直接塞给 <img> 又会被防盗链拦。
 *
 * 只放行人民网系域名，避免变成任人转发的开放代理（SSRF）。
 */

const ALLOWED_HOSTS = ["people.com.cn", "people.cn"];
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "缺少图片地址" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "图片地址无效" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "只支持 http/https" }, { status: 400 });
  }
  if (!hostAllowed(target.hostname)) {
    return NextResponse.json({ error: "该域名不允许代理" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target, {
      headers: { Referer: `${target.origin}/`, "User-Agent": UA },
      // 图片是静态资源，让 Next 侧多缓存一会儿
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `上游返回 ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "目标不是图片" }, { status: 415 });
    }

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "图片过大" }, { status: 413 });
    }

    return new Response(buffer, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
        "Content-Length": String(buffer.byteLength),
        "Content-Type": contentType,
      },
    });
  } catch {
    return NextResponse.json({ error: "图片下载失败" }, { status: 504 });
  }
}
