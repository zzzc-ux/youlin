"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** 按字拆分（中文逐字，英文数字按词），保留空格 */
function splitGraphemes(text: string): string[] {
  return text.match(/[A-Za-z0-9]+|\s|./gu) ?? [];
}

/**
 * 模糊渐显：逐字从模糊、下移状态浮现。
 */
export function BlurText({
  text,
  className,
  delay = 0,
  stagger = 0.045,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  as?: "span" | "h1" | "h2" | "p" | "div";
}) {
  const chars = useMemo(() => splitGraphemes(text), [text]);
  const MotionTag = motion[Tag];
  return (
    <MotionTag aria-label={text} className={cn("inline-block", className)}>
      {chars.map((ch, i) => (
        <motion.span
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          aria-hidden="true"
          className="inline-block whitespace-pre"
          initial={{ filter: "blur(10px)", opacity: 0, y: 14 }}
          // biome-ignore lint/suspicious/noArrayIndexKey: 字符顺序固定
          key={`${ch}-${i}`}
          transition={{ delay: delay + i * stagger, duration: 0.7, ease: EASE }}
        >
          {ch}
        </motion.span>
      ))}
    </MotionTag>
  );
}

/**
 * 流光文字：一道亮光周期性扫过文字。
 */
export function ShinyText({
  children,
  className,
  speed = 3,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
}) {
  return (
    <span
      className={cn("shiny-text", className)}
      style={{ "--shine-speed": `${speed}s` } as CSSProperties}
    >
      {children}
    </span>
  );
}

/**
 * 渐变文字：多色渐变在文字内缓慢流动。
 */
export function GradientText({
  children,
  className,
  colors = ["#a5b4fc", "#c084fc", "#67e8f9", "#a5b4fc"],
  speed = 8,
}: {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  speed?: number;
}) {
  return (
    <span
      className={cn("gradient-text", className)}
      style={
        {
          "--gradient-colors": colors.join(", "),
          "--gradient-speed": `${speed}s`,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}

/**
 * 轮播文字：几组词语轮流出现，逐字上滑切换。
 */
export function RotatingText({
  texts,
  className,
  interval = 2600,
  stagger = 0.03,
}: {
  texts: string[];
  className?: string;
  interval?: number;
  stagger?: number;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = setInterval(() => setIndex((i) => (i + 1) % texts.length), interval);
    return () => clearInterval(timer);
  }, [interval, texts.length]);

  const current = texts[index] ?? "";
  return (
    <span className={cn("relative inline-flex overflow-hidden align-bottom", className)}>
      <span className="sr-only">{current}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span aria-hidden="true" className="inline-flex" key={current} layout>
          {splitGraphemes(current).map((ch, i) => (
            <motion.span
              animate={{ opacity: 1, y: "0%" }}
              className="inline-block whitespace-pre"
              exit={{ opacity: 0, y: "-110%" }}
              initial={{ opacity: 0, y: "110%" }}
              // biome-ignore lint/suspicious/noArrayIndexKey: 字符顺序固定
              key={`${ch}-${i}`}
              transition={{ damping: 26, delay: i * stagger, stiffness: 320, type: "spring" }}
            >
              {ch}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * 渐入容器：进入视口时淡入上浮。
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 16,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ filter: "blur(6px)", opacity: 0, y }}
      transition={{ delay, duration: 0.6, ease: EASE }}
      viewport={{ margin: "-40px", once: true }}
      whileInView={{ filter: "blur(0px)", opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}
