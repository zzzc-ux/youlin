"use client";

import { motion } from "framer-motion";
import {
  BookOpenText,
  CheckIcon,
  CircleXIcon,
  LoaderCircleIcon,
  type LucideIcon,
  MessagesSquare,
  PackageCheck,
  PackageSearch,
  SearchCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Shimmer } from "../ai-elements/shimmer";

type CampusToolType =
  | "tool-searchCampus"
  | "tool-searchForum"
  | "tool-registerLost"
  | "tool-searchLost"
  | "tool-closeLost"
  | "tool-searchNotice"
  | "tool-createRepair"
  | "tool-searchRepair"
  | "tool-campusCard"
  | "tool-queryAccess";

const TOOL_META: Record<
  CampusToolType,
  { running: string; done: string; icon: LucideIcon; tint: string }
> = {
  "tool-closeLost": {
    done: "已更新失物状态",
    icon: PackageCheck,
    running: "正在更新失物状态",
    tint: "text-emerald-700 bg-emerald-500/10 ring-emerald-500/25 dark:text-emerald-300 dark:bg-emerald-400/10 dark:ring-emerald-300/20",
  },
  "tool-registerLost": {
    done: "已登记到失物库",
    icon: PackageSearch,
    running: "正在登记失物",
    tint: "text-sky-700 bg-sky-500/10 ring-sky-500/25 dark:text-sky-300 dark:bg-sky-400/10 dark:ring-sky-300/20",
  },
  "tool-searchCampus": {
    done: "已检索校园资料",
    icon: BookOpenText,
    running: "正在检索校园资料",
    tint: "text-violet-700 bg-violet-500/10 ring-violet-500/25 dark:text-violet-300 dark:bg-violet-400/10 dark:ring-violet-300/20",
  },
  "tool-searchForum": {
    done: "已查找论坛帖子",
    icon: MessagesSquare,
    running: "正在查找论坛帖子",
    tint: "text-fuchsia-700 bg-fuchsia-500/10 ring-fuchsia-500/25 dark:text-fuchsia-300 dark:bg-fuchsia-400/10 dark:ring-fuchsia-300/20",
  },
  "tool-searchLost": {
    done: "已查询失物库",
    icon: SearchCheck,
    running: "正在查询失物库",
    tint: "text-cyan-700 bg-cyan-500/10 ring-cyan-500/25 dark:text-cyan-300 dark:bg-cyan-400/10 dark:ring-cyan-300/20",
  },
  "tool-searchNotice": {
    done: "已查校园通知",
    icon: BookOpenText,
    running: "正在查校园通知",
    tint: "text-sky-700 bg-sky-500/10 ring-sky-500/25 dark:text-sky-300 dark:bg-sky-400/10 dark:ring-sky-300/20",
  },
  "tool-createRepair": {
    done: "已登记报修",
    icon: PackageSearch,
    running: "正在登记报修",
    tint: "text-amber-700 bg-amber-500/10 ring-amber-500/25 dark:text-amber-300 dark:bg-amber-400/10 dark:ring-amber-300/20",
  },
  "tool-searchRepair": {
    done: "已查报修进度",
    icon: SearchCheck,
    running: "正在查报修进度",
    tint: "text-amber-700 bg-amber-500/10 ring-amber-500/25 dark:text-amber-300 dark:bg-amber-400/10 dark:ring-amber-300/20",
  },
  "tool-campusCard": {
    done: "已查校园卡服务",
    icon: PackageCheck,
    running: "正在查校园卡服务",
    tint: "text-violet-700 bg-violet-500/10 ring-violet-500/25 dark:text-violet-300 dark:bg-violet-400/10 dark:ring-violet-300/20",
  },
  "tool-queryAccess": {
    done: "已查开放时间",
    icon: SearchCheck,
    running: "正在查开放时间",
    tint: "text-emerald-700 bg-emerald-500/10 ring-emerald-500/25 dark:text-emerald-300 dark:bg-emerald-400/10 dark:ring-emerald-300/20",
  },
};

/**
 * 工具调用状态条：图标 + 进度文字，进行中显示流光，完成后打勾。
 */
export function CampusToolChip({
  type,
  state,
}: {
  type: CampusToolType;
  state: string;
}) {
  const meta = TOOL_META[type];
  const Icon = meta.icon;
  const failed = state === "output-error" || state === "output-denied";
  const done = state === "output-available";

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1, y: 0 }}
      className="glass inline-flex w-fit items-center gap-2.5 rounded-full py-1.5 pr-3.5 pl-1.5 text-[13px]"
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className={cn("flex size-6 items-center justify-center rounded-full ring-1", meta.tint)}>
        <Icon className="size-3.5" />
      </span>
      {done || failed ? (
        <span className="text-foreground/80">{failed ? `${meta.running}失败` : meta.done}</span>
      ) : (
        <Shimmer as="span" className="font-medium" duration={1.2}>
          {`${meta.running}…`}
        </Shimmer>
      )}
      {done ? (
        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-300" />
      ) : failed ? (
        <CircleXIcon className="size-3.5 text-red-600 dark:text-red-300" />
      ) : (
        <LoaderCircleIcon className="size-3.5 animate-spin text-violet-600 dark:text-violet-300" />
      )}
    </motion.div>
  );
}
