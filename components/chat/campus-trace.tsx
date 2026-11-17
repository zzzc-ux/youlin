"use client";

import { CheckCircle2, ChevronDown, CircleAlert, Clock3, LoaderCircle } from "lucide-react";
import type { CampusTraceData, CampusTraceStep } from "@/lib/types";

function StepIcon({ state }: { state: CampusTraceStep["state"] }) {
  const className = "mt-0.5 size-4 shrink-0";
  if (state === "running") return <LoaderCircle aria-label="进行中" className={`${className} animate-spin text-violet-600 motion-reduce:animate-none dark:text-violet-300`} />;
  if (state === "waiting") return <Clock3 aria-label="等待处理" className={`${className} text-amber-700 dark:text-amber-300`} />;
  if (state === "error") return <CircleAlert aria-label="未完成" className={`${className} text-red-700 dark:text-red-300`} />;
  return <CheckCircle2 aria-label="已完成" className={`${className} text-emerald-700 dark:text-emerald-300`} />;
}

export function CampusTrace({ trace }: { trace: CampusTraceData }) {
  const steps = trace.steps ?? [];
  const running = steps.some((step) => step.state === "running");
  return (
    <details className="group w-full max-w-2xl rounded-xl border border-border bg-card text-card-foreground" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-medium focus-visible:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 [&::-webkit-details-marker]:hidden">
        <span>{running ? "正在处理" : "处理过程"}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-muted-foreground">
          <span className="hidden group-open:inline">收起详情</span>
          <span className="group-open:hidden">查看详情</span>
          <ChevronDown aria-hidden="true" className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </span>
      </summary>
      <div aria-live="polite" className="border-t border-border px-4 py-3">
        {steps.length > 0 ? (
          <ol className="space-y-2 text-[13px] leading-5">
            {steps.map((step) => (
              <li className="flex items-start gap-2.5" key={step.id}>
                <StepIcon state={step.state} />
                <span className="min-w-0 break-words">{step.label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            {trace.kindLabel}{trace.tool ? ` · ${trace.tool}` : ""}{trace.found ? "" : " · 未命中"}
          </p>
        )}
        {trace.sources.length > 0 ? (
          <p className="mt-3 break-words text-xs leading-5 text-muted-foreground">来源：{trace.sources.join("；")}</p>
        ) : null}
      </div>
    </details>
  );
}
