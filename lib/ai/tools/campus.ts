import { tool } from "ai";
import { z } from "zod";
import { queryAccessHours } from "@/lib/campus/access";
import { campusCardService } from "@/lib/campus/card-service";
import { createForumPost, getOpenForumPostForLostItem, searchForumPosts } from "@/lib/campus/forum";
import { forumCategories } from "@/lib/campus/forum-shared";
import { searchCampusKnowledge } from "@/lib/campus/knowledge";
import {
  closeOwnItem,
  createLostItem,
  findComplementaryItems,
  searchLostByText,
} from "@/lib/campus/lost-found";
import { searchNotices } from "@/lib/campus/notices";
import { createRepair, searchRepairs } from "@/lib/campus/repairs";

export function campusTools(userId: string, author = "同学") {
  return {
    publishForum: tool({
      description: "发布校园论坛帖子。必须先由用户确认完整的帖子预览。",
      execute: async ({ title, body, category, eventTime, place, lostItemId }) => {
        const post = await createForumPost({
          userId,
          author,
          title,
          body,
          category,
          eventTime: eventTime || null,
          place: place || null,
          lostItemId: lostItemId ?? null,
        });
        return { post };
      },
      inputSchema: z.object({
        title: z.string().trim().min(2).max(80),
        body: z.string().trim().min(2).max(2000),
        category: z.enum(forumCategories),
        eventTime: z.string().trim().max(80).optional(),
        place: z.string().trim().max(80).optional(),
        lostItemId: z.string().uuid().optional(),
      }),
    }),
    searchForum: tool({
      description:
        "查找校园论坛里的活动、讲座、社团、招领、求助和闲置帖子。用户问这周有什么、某个社团或某个地点的帖子时必须调用。问一周安排时不要填 category，这样活动、讲座和社团会一起返回。只有用户明确只要某一类时才填 category。",
      execute: async ({ query, category }) => {
        const posts = await searchForumPosts(query, category);
        return {
          found: posts.length > 0,
          posts: posts.map((post) => ({
            author: post.author,
            body: post.body,
            category: post.category,
            eventTime: post.eventTime,
            place: post.place,
            title: post.title,
          })),
        };
      },
      inputSchema: z.object({
        category: z
          .enum(["活动", "讲座", "社团", "招领", "求助", "闲置"])
          .optional(),
        query: z.string().describe("要查找的活动、地点或关键词"),
      }),
    }),
    searchCampus: tool({
      description:
        "检索校园公开资料，包括奖学金、困难认定、补卡、请假、讲座、食堂、兼职和校历。回答校园办事或生活问题时必须先调用。",
      execute: async ({ query }) => {
        const articles = searchCampusKnowledge(query);
        return {
          articles: articles.map((article) => ({
            body: article.body,
            civic: article.civic ?? "",
            source: article.source,
            title: article.title,
          })),
          found: articles.length > 0,
        };
      },
      inputSchema: z.object({
        query: z.string().describe("用户的问题原文"),
      }),
    }),
    registerLost: tool({
      description:
        "登记寻物或招领。用户说自己丢了东西时 kind 用 lost；说自己捡到时 kind 用 found。",
      execute: async (input) => {
        const item = await createLostItem({
          category: input.category ?? null,
          color: input.color ?? null,
          detail: input.detail,
          kind: input.kind,
          place: input.place ?? null,
          title: input.title,
          userId,
        });
        const matches = await findComplementaryItems(item);
        const matchPosts = await Promise.all(matches.map((match) => getOpenForumPostForLostItem(match.id)));
        const matchPostIndex = matchPosts.findIndex(Boolean);
        const matchPost = matchPostIndex >= 0 ? matchPosts[matchPostIndex] : null;
        return {
          item,
          matches,
          matchPost,
          matchPostItemId: matchPostIndex >= 0 ? matches[matchPostIndex].id : null,
        };
      },
      inputSchema: z.object({
        category: z.string().optional().describe("物品类别，如校园卡、书包"),
        color: z.string().optional(),
        detail: z.string().describe("用户原话"),
        kind: z.enum(["lost", "found"]),
        place: z.string().optional(),
        title: z.string().describe("简短标题，如黑色书包"),
      }),
    }),
    searchLost: tool({
      description: "查询仍开放的寻物和招领记录。",
      execute: async ({ query }) => {
        const items = await searchLostByText(query);
        return { items };
      },
      inputSchema: z.object({
        query: z.string().describe("物品、颜色或地点"),
      }),
    }),
    closeLost: tool({
      description: "用户确认寻物已找回或招领物品已归还时，关闭自己的记录。",
      execute: async ({ category, itemId }) => {
        const item = await closeOwnItem(userId, category ?? null, itemId);
        return { closed: Boolean(item), item };
      },
      inputSchema: z.object({
        category: z.string().optional().describe("要关闭的物品类别"),
        itemId: z.string().uuid().optional(),
      }),
    }),
    searchNotice: tool({
      description: "查找校园通知，如停水、停电、闭馆和材料截止。只返回样本通知。",
      execute: async ({ query }) => {
        const notices = searchNotices(query);
        return {
          found: notices.length > 0,
          notices: notices.map((notice) => ({
            body: notice.body,
            publishedAt: notice.publishedAt,
            source: notice.source,
            title: notice.title,
          })),
        };
      },
      inputSchema: z.object({
        query: z.string().describe("用户的问题原文"),
      }),
    }),
    createRepair: tool({
      description: "登记宿舍报修。必须已有房间和损坏项目，否则不要调用。",
      execute: async ({ detail, item, place }) => {
        const ticket = createRepair({ detail, item, place });
        return {
          item: ticket.item,
          place: ticket.place,
          status: ticket.status,
          ticketId: ticket.ticketId,
        };
      },
      inputSchema: z.object({
        detail: z.string(),
        item: z.string().describe("坏了什么，如灯、空调"),
        place: z.string().describe("楼栋和房间"),
      }),
    }),
    searchRepair: tool({
      description: "查询宿舍报修进度。",
      execute: async ({ query }) => {
        const tickets = searchRepairs(query);
        return {
          found: tickets.length > 0,
          tickets,
        };
      },
      inputSchema: z.object({
        query: z.string().describe("工单号、房间或损坏项目"),
      }),
    }),
    campusCard: tool({
      description: "校园卡挂失、补办或查询样本余额。不要编造实时余额。",
      execute: async ({ action }) => campusCardService(action),
      inputSchema: z.object({
        action: z.enum(["loss", "replace", "balance"]),
      }),
    }),
    queryAccess: tool({
      description: "查询图书馆、宿舍、教学楼、体育馆的开放时间。不查询刷卡记录。",
      execute: async ({ query }) => {
        const place = queryAccessHours(query);
        if (!place) {
          return { found: false, openHours: "", place: "", source: "" };
        }
        return {
          found: true,
          openHours: place.openHours,
          place: place.place,
          source: place.source,
        };
      },
      inputSchema: z.object({
        query: z.string().describe("地点，如图书馆或宿舍"),
      }),
    }),
  };
}
