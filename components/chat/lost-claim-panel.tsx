"use client";

import { useCallback, useEffect, useState } from "react";

type Message = { id: string; role: "发布者" | "联系者"; body: string };
type Thread = { id: string; messages: Message[] };
type Conversations = { isOwner: boolean; closed: boolean; threads: Thread[] };
const api = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/forum/claims`;

function MessageForm({ postId, threadId, refresh }: { postId: string; threadId?: string; refresh: () => Promise<void> }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form className="mt-3 space-y-2" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError("");
      try {
        const response = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId, threadId, body }) });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "发送失败");
        setBody("");
        await refresh();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "发送失败，请重试");
      } finally {
        setBusy(false);
      }
    }}>
      <label className="block text-xs text-muted-foreground">
        站内消息
        <textarea className="mt-1 block min-h-20 w-full rounded-xl border border-input bg-background p-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-violet-500" maxLength={500} onChange={(event) => setBody(event.target.value)} placeholder="描述可用于核对的物品特征，勿发送密码或证件号码" required value={body} />
      </label>
      {error ? <p className="text-xs text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      <button className="rounded-lg bg-foreground px-3 py-2 text-xs font-medium text-background disabled:opacity-50" disabled={busy || !body.trim()} type="submit">{busy ? "发送中…" : "发送站内消息"}</button>
    </form>
  );
}

export function LostClaimPanel({ postId, itemId }: { postId: string; itemId: string }) {
  const [data, setData] = useState<Conversations | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${api}?post=${encodeURIComponent(postId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("联系记录加载失败，请重试");
      setData(await response.json() as Conversations);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "联系记录加载失败");
    }
  }, [postId]);
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <section aria-label="站内联系" className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">站内联系</h3>
        <button className="text-xs text-violet-700 underline underline-offset-4 dark:text-violet-300" onClick={() => void refresh()} type="button">刷新消息</button>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">消息仅双方可见。请核对物品特征，勿发送密码、验证码或证件号码；系统不会代替双方核验身份。</p>
      {error ? <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
      {!data && !error ? <p className="mt-2 text-xs text-muted-foreground">正在加载联系记录…</p> : null}
      {data?.isOwner ? <p className="mt-2 text-xs text-muted-foreground">完成交接后，可回到对话说“编号 {itemId.slice(0, 8)} 已归还”或“编号 {itemId.slice(0, 8)} 已找回”，确认后关闭记录。</p> : null}
      {data?.threads.map((thread, index) => (
        <div className="mt-3 rounded-xl bg-muted/50 p-3" key={thread.id}>
          {data.isOwner ? <p className="text-xs font-medium">联系记录 {index + 1}</p> : null}
          <ol className="mt-2 space-y-2 text-sm">
            {thread.messages.map((message) => <li className="break-words" key={message.id}><span className="mr-2 text-xs text-muted-foreground">{message.role}</span>{message.body}</li>)}
          </ol>
          {!data.closed ? <MessageForm postId={postId} refresh={refresh} threadId={thread.id} /> : null}
        </div>
      ))}
      {data?.isOwner && data.threads.length === 0 ? <p className="mt-3 text-xs text-muted-foreground">暂时没有人联系，之后可返回此页刷新。</p> : null}
      {data && !data.isOwner && data.threads.length === 0 && !data.closed ? <MessageForm postId={postId} refresh={refresh} /> : null}
      {data?.closed ? <p className="mt-3 text-xs text-muted-foreground">发布者已关闭该记录，不能发送新消息。</p> : null}
    </section>
  );
}
