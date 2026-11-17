import { ForumBoard } from "@/components/chat/forum-board";

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ post?: string | string[] }>;
}) {
  const { post } = await searchParams;
  const postId = typeof post === "string" ? post : undefined;
  return <ForumBoard initialPostId={postId} key={postId ?? "all"} />;
}
