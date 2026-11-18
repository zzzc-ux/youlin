import "server-only";
import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";

/**
 * 把搜索结果里的图片抓取到本地存储。
 *
 * 安全要点（该接口的 URL 来自不可信的第三方搜索结果，必须当作外部输入处理）：
 * 1. 只允许 http/https；
 * 2. 逐跳校验重定向，拒绝内网 / 回环 / 链路本地地址，防 SSRF；
 * 3. 限制体积与超时；
 * 4. 用文件头（magic bytes）判断真实类型，不信任 Content-Type。
 */

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 15_000;

const FETCH_HEADERS: Record<string, string> = {
  Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
};

export type GrabbedImage = {
  bytes: number;
  contentType: string;
  pathname: string;
  /** 可直接用于 <img src> 的地址 */
  url: string;
};

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  // 组播与保留段
  return a >= 224;
}

function isPrivateIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    return isPrivateIpv4(ip);
  }
  if (family === 6) {
    const value = ip.toLowerCase();
    if (value === "::1" || value === "::") {
      return true;
    }
    if (value.startsWith("::ffff:")) {
      return isPrivateIpv4(value.slice("::ffff:".length));
    }
    return (
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80") ||
      value.startsWith("ff")
    );
  }
  return true;
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只支持 http/https 图片地址");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("不允许访问内网地址");
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error("不允许访问内网地址");
    }
    return;
  }
  const records = await lookup(hostname, { all: true }).catch(() => []);
  if (records.length === 0) {
    throw new Error("图片域名解析失败");
  }
  if (records.some((record) => isPrivateIp(record.address))) {
    throw new Error("不允许访问内网地址");
  }
}

async function fetchImageResponse(input: string): Promise<Response> {
  let current = new URL(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: 重定向必须逐跳校验，不能并发
    await assertPublicHost(current);
    const response = await fetch(current, {
      cache: "no-store",
      headers: FETCH_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) {
        throw new Error(
          `图片地址重定向缺少 Location（HTTP ${response.status}）`
        );
      }
      current = new URL(location, current);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`图片下载失败：HTTP ${response.status}`);
    }

    return response;
  }

  throw new Error("图片地址重定向次数过多");
}

function detectImageType(
  buffer: Buffer
): { contentType: string; ext: string } | null {
  if (buffer.length < 12) {
    return null;
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", ext: "jpg" };
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { contentType: "image/png", ext: "png" };
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return { contentType: "image/gif", ext: "gif" };
  }
  const isWebp =
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  if (isWebp) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

async function readWithinLimit(response: Response): Promise<Buffer> {
  const declared = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10
  );
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error(
      `图片超过 ${Math.round(MAX_BYTES / 1024 / 1024)}MB 上限（声明 ${Math.round(declared / 1024)}KB）`
    );
  }

  if (!response.body) {
    throw new Error("图片响应为空");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();

  try {
    for (;;) {
      // biome-ignore lint/performance/noAwaitInLoops: 流式读取用于逐块累计体积，超限立即中断
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.byteLength;
      if (total > MAX_BYTES) {
        throw new Error(
          `图片超过 ${Math.round(MAX_BYTES / 1024 / 1024)}MB 上限`
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}

async function persist(
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<{ pathname: string; url: string }> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (token) {
    const { put } = await import("@vercel/blob");
    const result = await put(`search/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token,
    });
    return { pathname: result.pathname, url: result.url };
  }

  // 本地单机模式：写到 public/uploads，重启不丢
  const dir = path.join(process.cwd(), "public", "uploads", "search");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return {
    pathname: `uploads/search/${filename}`,
    url: `/uploads/search/${filename}`,
  };
}

/**
 * 下载图片并落地，返回可直接展示的地址。
 * 任何一步失败都抛错，让上层决定是提示用户还是换一条结果。
 */
export async function grabImage(imageUrl: string): Promise<GrabbedImage> {
  const trimmed = imageUrl.trim();
  if (!trimmed) {
    throw new Error("图片地址不能为空");
  }

  const response = await fetchImageResponse(trimmed);
  const buffer = await readWithinLimit(response);
  const detected = detectImageType(buffer);

  if (!detected) {
    throw new Error(
      "该地址返回的不是有效图片（可能是网页或视频），请换一条结果"
    );
  }

  const hash = createHash("sha1").update(trimmed).digest("hex").slice(0, 24);
  const filename = `${hash}.${detected.ext}`;
  const stored = await persist(filename, buffer, detected.contentType);

  return {
    bytes: buffer.byteLength,
    contentType: detected.contentType,
    pathname: stored.pathname,
    url: stored.url,
  };
}
