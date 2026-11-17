import assert from "node:assert/strict";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { routeCampus, runCampusEngine } from "../lib/campus/engine";
import { createLostItem, listOpenItems, searchLostByText } from "../lib/campus/lost-found";
import { createDatabase } from "../lib/db/client";
import { searchRepairs } from "../lib/campus/repairs";
import { createForumPost, deleteForumPost, getForumPostById, listForumPosts, listForumPostsByUser, searchForumPosts, updateForumPost } from "../lib/campus/forum";
import { sql } from "drizzle-orm";
import type { CampusTraceStep } from "../lib/types";
import { getClaimConversations, sendClaimMessage } from "../lib/campus/claims";

test("多轮查询保留主题，七类校园问题可路由", () => {
  const cases = [
    ["6号楼停水吗", "notice"], ["6号楼312灯坏了", "repair"],
    ["校园卡余额", "card"], ["图书馆开放时间", "access"],
    ["这周有什么活动", "forum"], ["我丢了雨伞", "lost"], ["奖学金怎么申请", "qa"],
    ["停电公告", "notice"], ["宿舍报修空调坏了", "repair"],
    ["一卡通余额", "card"], ["体育馆几点关门", "access"],
    ["论坛社团招新", "forum"], ["捡到一把钥匙", "lost"], ["家庭经济困难认定", "qa"],
  ] as const;
  for (const [text, kind] of cases) assert.equal(routeCampus(text, []).kind, kind, text);
  const followup = routeCampus("那几点恢复", [{ role: "user", text: "6号楼停水吗" }]);
  assert.equal(followup.kind, "notice");
  assert.match(followup.query, /停水/);
});

test("登记、取消、并发确认及精确关闭只作用于目标记录", async () => {
  const original = process.cwd();
  const originalPostgres = process.env.POSTGRES_URL;
  const temp = await mkdtemp(path.join(os.tmpdir(), "campus-engine-"));
  await cp(path.join(original, "lib", "db", "migrations"), path.join(temp, "lib", "db", "migrations"), { recursive: true });
  process.chdir(temp);
  delete process.env.POSTGRES_URL;
  const userId = crypto.randomUUID();
  const chatId = crypto.randomUUID();
  const run = (text: string) => runCampusEngine({ text, history: [], userId, chatId });
  try {
    const before = (await listOpenItems()).filter((item) => item.userId === userId).length;
    assert.equal((await run("我丢了一个紫色雨伞")).pending, true);
    assert.equal((await listOpenItems()).filter((item) => item.userId === userId).length, before);
    const otherUser = await runCampusEngine({ text: "确认", history: [], userId: crypto.randomUUID(), chatId });
    assert.equal(otherUser.found, false);
    const confirmed = await Promise.all([run("确认"), run("确认")]);
    assert.equal(confirmed.filter((item) => item.found).length, 1);
    let own = (await listOpenItems()).filter((item) => item.userId === userId);
    assert.equal(own.length, 1);
    assert.equal(own[0].title, "紫色雨伞");
    assert.equal(own[0].category, "雨伞");
    await run("我丢了钥匙");
    await run("取消");
    assert.equal((await listOpenItems()).filter((item) => item.userId === userId).length, 1);
    const close = await run("雨伞已经找回了");
    assert.equal(close.pending, true);
    await run("确认");
    own = (await listOpenItems()).filter((item) => item.userId === userId);
    assert.equal(own.length, 0);
    assert.equal((await run("6号楼312灯坏了")).pending, true);
    assert.equal(searchRepairs("6号楼312").length, 0);
    assert.equal((await run("确认")).found, true);
    assert.equal(searchRepairs("6号楼312").length, 1);
    const notice = await run("6号楼停水吗");
    assert.equal(notice.kind, "notice");
    assert.equal(notice.found, true);
    assert.match(notice.answer, /来源/);

    const originalPosts = await listForumPosts();
    const postInput = { history: [], userId, chatId, author: "student@example.test" };
    const previewSteps: CampusTraceStep[] = [];
    const preview = await runCampusEngine({ ...postInput, text: "我在图书馆丢了一把紫色雨伞，帮我发到论坛", report: (step) => previewSteps.push(step) });
    assert.equal(preview.pending, true);
    assert.match(preview.answer, /分类：求助/);
    assert.match(preview.answer, /内容：我在图书馆丢了一把紫色雨伞/);
    assert.equal((await listForumPosts()).length, originalPosts.length);
    assert.ok(previewSteps.some((step) => step.state === "waiting" && step.label.includes("等待确认")));
    assert.equal(previewSteps.some((step) => step.id === "execute"), false);
    const confirmationSteps: CampusTraceStep[] = [];
    const publishResults = await Promise.all([
      runCampusEngine({ ...postInput, text: "确认发布", report: (step) => confirmationSteps.push(step) }),
      runCampusEngine({ ...postInput, text: "确认发布" }),
    ]);
    assert.equal(publishResults.filter((entry) => entry.found).length, 1);
    if (publishResults[0].found) {
      assert.deepEqual(confirmationSteps.filter((step) => step.id === "execute").map((step) => step.state), ["running", "done"]);
    } else {
      assert.equal(confirmationSteps.some((step) => step.id === "execute"), false);
    }
    const posts = (await listForumPosts()).filter((entry) => entry.userId === userId);
    assert.equal(posts.length, 1);
    assert.equal(publishResults.find((entry) => entry.found)?.forumPostId, posts[0].id);
    assert.equal((await getForumPostById(posts[0].id))?.body, posts[0].body);
    assert.equal(await getForumPostById(crypto.randomUUID()), null);
    assert.equal(posts[0].body, "我在图书馆丢了一把紫色雨伞");
    assert.equal(posts[0].author, "校园同学");
    assert.equal(posts[0].category, "求助");

    const draft = await runCampusEngine({ ...postInput, text: "帮我在论坛发帖子" });
    assert.match(draft.answer, /请告诉我要发布的帖子内容/);
    const followup = await runCampusEngine({ ...postInput, text: "我捡到一串钥匙", history: [{ role: "user", text: "帮我在论坛发帖子" }, { role: "assistant", text: draft.answer }] });
    assert.equal(followup.pending, true);
    assert.match(followup.answer, /分类：招领/);
    await runCampusEngine({ ...postInput, text: "取消" });
    assert.equal((await listForumPosts()).filter((entry) => entry.userId === userId).length, 1);
    const fromHistory = await runCampusEngine({ ...postInput, text: "发到论坛", history: [{ role: "user", text: "我丢了黑色书包" }, { role: "assistant", text: "已登记。" }] });
    assert.equal(fromHistory.pending, true);
    assert.match(fromHistory.answer, /内容：我丢了黑色书包/);
    await runCampusEngine({ ...postInput, text: "取消" });
    const direct = await runCampusEngine({ ...postInput, text: "我丢了紫色雨伞，帮我发布" });
    assert.equal(direct.pending, true);
    assert.match(direct.answer, /内容：我丢了紫色雨伞/);
    assert.match(direct.answer, /发布者：校园同学/);
    await runCampusEngine({ ...postInput, text: "取消" });

    // 拾物者登记、发布、双方站内核对，最后由登记人确认归还。
    const foundPreview = await run("我在图书馆捡到一张校园卡，手机号13800138000");
    assert.equal(foundPreview.pending, true);
    const registered = await run("确认");
    assert.match(registered.answer, /已登记招领/);
    const foundItem = (await listOpenItems()).find((item) => item.userId === userId && item.kind === "found");
    assert.ok(foundItem);
    assert.doesNotMatch(foundItem.detail, /13800138000/);
    const linkedPreview = await runCampusEngine({ ...postInput, text: "发布这条失物到论坛", history: [{ role: "assistant", text: registered.answer }] });
    assert.equal(linkedPreview.pending, true);
    assert.match(linkedPreview.answer, new RegExp(foundItem.id.slice(0, 8)));
    assert.doesNotMatch(linkedPreview.answer, /13800138000/);
    const linkedPublished = await runCampusEngine({ ...postInput, text: "确认发布" });
    assert.ok(linkedPublished.forumPostId);
    const linkedId = linkedPublished.forumPostId;
    const linkedPost = await getForumPostById(linkedId);
    assert.equal(linkedPost?.lostItemId, foundItem.id);
    assert.equal(linkedPost?.lostItemStatus, "open");
    assert.equal(linkedPost?.author, "校园同学");
    const duplicate = await runCampusEngine({ ...postInput, text: `将编号 ${foundItem.id.slice(0, 8)} 的失物发到论坛` });
    assert.equal(duplicate.forumPostId, linkedId);
    assert.equal(duplicate.pending, undefined);
    assert.equal((await searchLostByText("完全无关的词语")).length, 0);
    const claimant = crypto.randomUUID();
    const outsider = crypto.randomUUID();
    const outsiderClose = await runCampusEngine({ text: `编号 ${foundItem.id.slice(0, 8)} 已归还`, history: [], userId: outsider, chatId: crypto.randomUUID() });
    assert.equal(outsiderClose.pending, undefined);
    assert.equal((await getForumPostById(linkedId))?.lostItemStatus, "open");
    const claimantChat = crypto.randomUUID();
    const lostPreview = await runCampusEngine({ text: "我丢了校园卡", history: [], userId: claimant, chatId: claimantChat });
    assert.equal(lostPreview.pending, true);
    const match = await runCampusEngine({ text: "确认", history: [], userId: claimant, chatId: claimantChat });
    assert.match(match.answer, /可能相关/);
    assert.equal(match.forumPostId, linkedId);
    assert.equal(match.forumPostLabel, "查看相关帖子");
    await sendClaimMessage({ postId: linkedId, userId: claimant, body: "卡套是蓝色的，想核对一下。" });
    const ownerInbox = await getClaimConversations(linkedId, userId);
    assert.equal(ownerInbox.isOwner, true);
    assert.equal(ownerInbox.threads.length, 1);
    const threadId = ownerInbox.threads[0].id;
    assert.equal((await getClaimConversations(linkedId, outsider)).threads.length, 0);
    await assert.rejects(() => sendClaimMessage({ postId: linkedId, userId: outsider, threadId, body: "越权消息" }), /无权限/);
    await sendClaimMessage({ postId: linkedId, userId, threadId, body: "请核对更多不公开的特征。" });
    assert.equal((await getClaimConversations(linkedId, claimant)).threads[0].messages.length, 2);
    const closedPreview = await run(`编号 ${foundItem.id.slice(0, 8)} 已归还`);
    assert.equal(closedPreview.pending, true);
    assert.equal((await getForumPostById(linkedId))?.lostItemStatus, "open");
    await run("确认");
    assert.equal((await getForumPostById(linkedId))?.lostItemStatus, "closed");
    assert.equal((await searchForumPosts("校园卡")).some((post) => post.id === linkedId), false);
    await assert.rejects(() => sendClaimMessage({ postId: linkedId, userId: claimant, threadId, body: "还在吗" }), /已关闭/);
    assert.equal((await getClaimConversations(linkedId, claimant)).threads[0].messages.length, 2);

    const manualPost = await createForumPost({ userId, author: "student@example.test", category: "招领", title: "捡到雨伞 13800138000", body: "联系电话 13800138000", place: "联系 13800138000", eventTime: null });
    assert.equal(manualPost.author, "校园同学");
    assert.doesNotMatch(`${manualPost.title}${manualPost.body}${manualPost.place}`, /13800138000/);

    const db = await createDatabase();
    await db.execute(sql`INSERT INTO "ForumPost" ("userId", "author", "category", "title", "body", "createdAt") SELECT ${userId}, '测试', '活动', '后续帖子', '后续内容', now() + interval '1 day' FROM generate_series(1, 81)`);
    assert.equal((await listForumPosts()).some((post) => post.id === posts[0].id), false);
    assert.equal((await getForumPostById(posts[0].id))?.id, posts[0].id);
  } finally {
    const db = await createDatabase();
    await (db as unknown as { $client: { close: () => Promise<void> } }).$client.close();
    (globalThis as Record<string, unknown>).chatbotDb = undefined;
    process.chdir(original);
    if (originalPostgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = originalPostgres;
    await rm(temp, { recursive: true, force: true });
  }
});

test("我的帖子：筛选、编辑、删除及权限隔离", async () => {
  const original = process.cwd();
  const originalPostgres = process.env.POSTGRES_URL;
  const temp = await mkdtemp(path.join(os.tmpdir(), "campus-forum-manage-"));
  await cp(path.join(original, "lib", "db", "migrations"), path.join(temp, "lib", "db", "migrations"), { recursive: true });
  process.chdir(temp);
  delete process.env.POSTGRES_URL;
  // 前一个用例已关闭进程内全局数据库实例，这里重置缓存以便在新目录重新打开
  (globalThis as Record<string, unknown>).chatbotDb = undefined;
  const owner = crypto.randomUUID();
  const other = crypto.randomUUID();
  try {
    const minePost = await createForumPost({ userId: owner, author: "owner@example.test", category: "活动", title: "周末羽毛球活动", body: "周六下午体育馆，自带球拍。", place: "体育馆", eventTime: "周六 15:00" });
    const otherPost = await createForumPost({ userId: other, author: "other@example.test", category: "闲置", title: "出键盘", body: "九成新机械键盘。", place: null, eventTime: null });

    // 只看到自己的帖子
    const mineList = await listForumPostsByUser(owner);
    assert.equal(mineList.some((post) => post.id === minePost.id), true);
    assert.equal(mineList.some((post) => post.id === otherPost.id), false);
    const mineSearch = await searchForumPosts("键盘", undefined, owner);
    assert.equal(mineSearch.some((post) => post.id === otherPost.id), false);

    // 编辑：仅作者本人可改
    assert.equal(await updateForumPost({ id: minePost.id, userId: other, category: "活动", title: "被他人篡改", body: "篡改内容", place: null, eventTime: null }), null);
    const updated = await updateForumPost({ id: minePost.id, userId: owner, category: "招领", title: "捡到校园卡 13800138000", body: "联系电话 13800138000", place: "图书馆 13800138000", eventTime: null });
    assert.ok(updated);
    assert.equal(updated.author, "校园同学");
    assert.doesNotMatch(`${updated.title}${updated.body}${updated.place}`, /13800138000/);
    assert.equal(updated.category, "招领");

    // 删除：仅作者本人可删，且清理认领私信
    const item = await createLostItem({ userId: owner, kind: "found", title: "钥匙", detail: "在食堂捡到一串钥匙。", place: "食堂", color: null, category: "钥匙" });
    const linked = await createForumPost({ userId: owner, author: "owner@example.test", category: "招领", title: "捡到钥匙", body: "在食堂捡到一串钥匙。", place: "食堂", eventTime: null, lostItemId: item.id });
    const claimant = crypto.randomUUID();
    await sendClaimMessage({ postId: linked.id, userId: claimant, body: "是我的钥匙。" });
    assert.equal(await deleteForumPost(linked.id, other), false);
    assert.equal(await deleteForumPost(linked.id, owner), true);
    assert.equal(await getForumPostById(linked.id), null);
    await assert.rejects(() => getClaimConversations(linked.id, owner));
  } finally {
    const db = await createDatabase();
    await (db as unknown as { $client: { close: () => Promise<void> } }).$client.close();
    process.chdir(original);
    if (originalPostgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = originalPostgres;
    await rm(temp, { recursive: true, force: true });
  }
});
