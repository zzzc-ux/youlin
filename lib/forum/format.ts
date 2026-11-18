const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const TONES = [
  "#6B5B7A",
  "#57657A",
  "#4F6A6A",
  "#6A5F57",
  "#74564E",
  "#5C6B57",
  "#7A6A4F",
  "#4F6270",
];

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  // 数据库返回 "2026-11-17 15:10:26.755"，Safari 不接受，需要补 T
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

function pad(value: number) {
  return value < 10 ? `0${value}` : `${value}`;
}

function clock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 相对时间：刚刚 / 12 分钟前 / 昨天 21:40 / 3 月 4 日 */
export function formatRelativeTime(value: string | Date): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }
  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) {
    return "刚刚";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} 分钟前`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)} 小时前`;
  }
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);
  if (days === 1) {
    return `昨天 ${clock(date)}`;
  }
  if (days === 2) {
    return `前天 ${clock(date)}`;
  }
  if (days < 7) {
    return `${days} 天前`;
  }
  if (date.getFullYear() !== new Date().getFullYear()) {
    return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

/** 绝对时间，用于 title 提示与 <time datetime> */
export function formatAbsoluteTime(value: string | Date): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock(date)}`;
}

export function formatDate(value: string | Date): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function isToday(value: string | Date): boolean {
  const date = toDate(value);
  return date ? startOfDay(date) === startOfDay(new Date()) : false;
}

/** 列表摘要：压平换行，超长截断 */
export function excerpt(body: string, max = 120): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 作者展示名：邮箱取 @ 前部分 */
export function displayName(author: string): string {
  const name = author.includes("@") ? author.split("@")[0] : author;
  return name.trim() || "同学";
}

/** 由作者名稳定派生头像底色，同一人永远同色 */
export function avatarTone(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000_007;
  }
  return TONES[hash % TONES.length];
}

/** 帖子编号，用于详情页面包屑 */
export function postNumber(id: string): string {
  return `No.${id.replaceAll("-", "").slice(0, 4).toUpperCase()}`;
}
