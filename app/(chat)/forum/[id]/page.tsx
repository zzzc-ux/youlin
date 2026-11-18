import { PostDetail } from "@/components/forum/post-detail";

export default async function ForumPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostDetail postId={id} />;
}
