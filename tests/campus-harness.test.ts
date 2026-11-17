import assert from "node:assert/strict";
import test from "node:test";
import { createUIMessageStream, readUIMessageStream } from "ai";
import { classifyCampus } from "../lib/campus/harness";
import type { ChatMessage } from "../lib/types";

test("失物登记和关闭都只做分类", () => {
  for (const text of ["我丢了一个紫色雨伞", "我捡到一把雨伞", "已经找回了"]) {
    assert.equal(classifyCampus(text), "lost");
  }
});

test("流式进度更新同一条处理过程并保存在消息中", async () => {
  const stream = createUIMessageStream<ChatMessage>({
    execute: ({ writer }) => {
      const trace = { kindLabel: "论坛", tool: "publishForum", sources: [], found: false };
      writer.write({ type: "data-campus-trace", id: "trace-1", data: { ...trace, steps: [{ id: "draft", label: "正在准备", state: "running" }] } });
      writer.write({ type: "data-campus-trace", id: "trace-1", data: { ...trace, steps: [{ id: "draft", label: "等待确认", state: "waiting" }] } });
      writer.write({ type: "start" });
      writer.write({ type: "text-start", id: "text-1" });
      writer.write({ type: "text-delta", id: "text-1", delta: "请确认" });
      writer.write({ type: "text-end", id: "text-1" });
      writer.write({ type: "finish" });
    },
  });
  let message: ChatMessage | undefined;
  for await (const item of readUIMessageStream<ChatMessage>({ stream })) message = item;
  const parts = message?.parts.filter((part) => part.type === "data-campus-trace") ?? [];
  assert.equal(parts.length, 1);
  assert.equal(parts[0].data.steps?.[0].state, "waiting");
});
