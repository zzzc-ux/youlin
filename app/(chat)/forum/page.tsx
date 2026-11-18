import { redirect } from "next/navigation";
import { ForumList } from "@/components/forum/forum-list";
import { listNotices } from "@/lib/campus/notices";

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string | string[]; post?: string | string[] }>;
}) {
  const { c, post } = await searchParams;
  const postId = typeof post === "string" ? post : undefined;
  if (postId) {
    redirect(`/forum/${encodeURIComponent(postId)}`);
  }
  const category = typeof c === "string" ? c : undefined;
  return <ForumList initialCategory={category} notices={listNotices(3)} />;
}
