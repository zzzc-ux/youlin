export const forumCategories = ["活动", "讲座", "社团", "招领", "求助", "闲置"] as const;

export type ForumCategory = (typeof forumCategories)[number];

export type ForumPost = {
  id: string;
  userId: string;
  author: string;
  category: string;
  title: string;
  body: string;
  place: string | null;
  eventTime: string | null;
  createdAt: string;
  lostItemId?: string | null;
  lostItemStatus?: "open" | "closed" | null;
  /** 服务端计算：当前请求用户是否为帖子作者 */
  mine?: boolean;
  /** 服务端计算：该帖评论数 */
  commentCount?: number;
};

export type ForumComment = {
  id: string;
  postId: string;
  userId: string;
  author: string;
  body: string;
  /** 回复目标评论 id；只保留两级，回复的回复会挂到根评论下 */
  parentId: string | null;
  createdAt: string;
  /** 服务端计算：当前请求用户是否为评论作者 */
  mine?: boolean;
};
