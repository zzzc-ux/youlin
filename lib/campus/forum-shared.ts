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
};
