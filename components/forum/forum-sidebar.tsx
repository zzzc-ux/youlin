import Link from "next/link";
import type { ForumPost } from "@/lib/campus/forum-shared";
import type { CampusNotice } from "@/lib/campus/notices";
import {
  displayName,
  formatDate,
  formatRelativeTime,
} from "@/lib/forum/format";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[12px] font-medium tracking-[0.06em] text-foreground/45">
      {children}
    </h2>
  );
}

export function ForumSidebar({
  notices,
  posts,
}: {
  notices: CampusNotice[];
  posts: ForumPost[];
}) {
  const hot = [...posts]
    .sort((a, b) => {
      const diff = (b.commentCount ?? 0) - (a.commentCount ?? 0);
      return diff === 0 ? b.createdAt.localeCompare(a.createdAt) : diff;
    })
    .slice(0, 5);

  const recent = [...posts]
    .filter((post) => post.lastReplyAt)
    .sort((a, b) => (b.lastReplyAt ?? "").localeCompare(a.lastReplyAt ?? ""))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionTitle>本周热议</SectionTitle>
        <ol className="mt-3 flex flex-col gap-2.5">
          {hot.map((post, index) => (
            <li className="flex gap-2.5" key={post.id}>
              <span className="w-2.5 shrink-0 pt-px font-mono text-[11px] text-foreground/30">
                {index + 1}
              </span>
              <Link
                className="line-clamp-2 text-[12.5px] leading-[1.55] text-foreground/70 transition-colors duration-150 hover:text-primary"
                href={`/forum/${post.id}`}
              >
                {post.title}
              </Link>
            </li>
          ))}
          {hot.length === 0 ? (
            <li className="text-[12.5px] text-foreground/40">还没有讨论。</li>
          ) : null}
        </ol>
      </section>

      <section>
        <SectionTitle>最近回复</SectionTitle>
        <div className="mt-3">
          {recent.map((post) => (
            <div
              className="border-b border-border/50 py-2 last:border-b-0"
              key={post.id}
            >
              <Link
                className="line-clamp-2 text-[12.5px] leading-[1.6] text-foreground/60 transition-colors duration-150 hover:text-primary"
                href={`/forum/${post.id}`}
              >
                <span className="text-foreground/80">
                  {displayName(post.lastReplyAuthor ?? "")}
                </span>{" "}
                在《{post.title}》里说
                <span className="text-foreground/40">
                  {" "}
                  {formatRelativeTime(post.lastReplyAt ?? "")}
                </span>
              </Link>
            </div>
          ))}
          {recent.length === 0 ? (
            <p className="text-[12.5px] text-foreground/40">
              这一栏还空着，等第一个开口的人。
            </p>
          ) : null}
        </div>
      </section>

      {notices.length > 0 ? (
        <section>
          <SectionTitle>校园公告</SectionTitle>
          <div className="mt-3">
            {notices.map((notice) => (
              <div
                className="border-b border-border/50 py-2 last:border-b-0"
                key={notice.title}
              >
                <p className="text-[12.5px] leading-[1.6] text-foreground/70">
                  {notice.title}
                </p>
                <p className="mt-0.5 text-[11.5px] text-foreground/40">
                  {formatDate(notice.publishedAt)} · {notice.source}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="text-[11.5px] leading-[1.7] text-foreground/40">
        <p>论坛由学生技术组维护。</p>
        <p className="mt-1">请勿发布手机号、证件号与住址。</p>
      </section>
    </div>
  );
}
