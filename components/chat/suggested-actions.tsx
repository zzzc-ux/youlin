"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  type LucideIcon,
  MessagesSquare,
  PackageSearch,
  Search,
  UtensilsCrossed,
} from "lucide-react";
import { memo, useCallback } from "react";
import { suggestions } from "@/lib/constants";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SpotlightCard } from "../effects/spotlight-card";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

const STYLES: { icon: LucideIcon; tint: string; glow: string; label: string }[] = [
  { glow: "oklch(0.75 0.13 230 / 0.25)", icon: PackageSearch, label: "失物登记", tint: "text-sky-700 bg-sky-500/10 dark:text-sky-300 dark:bg-sky-400/10" },
  { glow: "oklch(0.75 0.15 190 / 0.25)", icon: Search, label: "失物查询", tint: "text-cyan-700 bg-cyan-500/10 dark:text-cyan-300 dark:bg-cyan-400/10" },
  { glow: "oklch(0.72 0.18 300 / 0.25)", icon: MessagesSquare, label: "论坛活动", tint: "text-fuchsia-700 bg-fuchsia-500/10 dark:text-fuchsia-300 dark:bg-fuchsia-400/10" },
  { glow: "oklch(0.8 0.14 70 / 0.25)", icon: UtensilsCrossed, label: "生活建议", tint: "text-amber-700 bg-amber-500/10 dark:text-amber-300 dark:bg-amber-400/10" },
];

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      window.history.pushState(
        {},
        "",
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
      );
      sendMessage({
        parts: [{ text: suggestion, type: "text" }],
        role: "user",
      });
    },
    [chatId, sendMessage]
  );

  return (
    <div
      className="flex w-full gap-3 overflow-x-auto pb-1 no-scrollbar sm:grid sm:grid-cols-2 sm:overflow-visible"
      data-testid="suggested-actions"
    >
      {suggestions.map((suggestion, index) => {
        const style = STYLES[index % STYLES.length];
        const Icon = style.icon;
        return (
          <motion.div
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            className="min-w-[230px] shrink-0 sm:min-w-0 sm:shrink"
            exit={{ opacity: 0, y: 16 }}
            initial={{ filter: "blur(6px)", opacity: 0, y: 18 }}
            key={suggestion}
            transition={{ delay: 0.25 + 0.08 * index, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <SpotlightCard
              className="cursor-pointer rounded-2xl hover:-translate-y-0.5"
              spotlight={style.glow}
            >
              <button
                className="group/sugg flex w-full items-start gap-3 p-3.5 text-left"
                onClick={() => handleSuggestionClick(suggestion)}
                type="button"
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-border", style.tint)}>
                  <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[11px] text-muted-foreground">{style.label}</span>
                  <span className="mt-0.5 text-[13px] text-foreground/90 leading-snug">{suggestion}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover/sugg:-translate-y-0.5 group-hover/sugg:translate-x-0.5 group-hover/sugg:text-violet-500" />
              </button>
            </SpotlightCard>
          </motion.div>
        );
      })}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
