import type { ComponentProps, ElementType } from "react";
import { cn } from "@/lib/utils";

type StarBorderProps<T extends ElementType> = {
  as?: T;
  /** 流光颜色 */
  color?: string;
  /** 绕行一圈的秒数 */
  speed?: number;
  innerClassName?: string;
} & ComponentProps<T>;

/**
 * 流光边框：两团光沿着上下边缘来回流动，常用于主按钮。
 */
export function StarBorder<T extends ElementType = "button">({
  as,
  className,
  innerClassName,
  color = "oklch(0.85 0.14 290)",
  speed = 5,
  children,
  style,
  ...props
}: StarBorderProps<T>) {
  const Component = (as ?? "button") as ElementType;
  return (
    <Component
      className={cn("star-border relative inline-block overflow-hidden rounded-[14px] p-px", className)}
      style={{ "--star-color": color, "--star-speed": `${speed}s`, ...style } as React.CSSProperties}
      {...props}
    >
      <span aria-hidden="true" className="star-border-glow star-border-bottom" />
      <span aria-hidden="true" className="star-border-glow star-border-top" />
      <span
        className={cn(
          "relative z-[1] flex size-full items-center justify-center gap-2 rounded-[13px] border border-white/10 bg-gradient-to-b from-[oklch(0.27_0.06_280)] to-[oklch(0.17_0.04_275)] px-5 py-2.5 font-medium text-[14px] text-white",
          innerClassName
        )}
      >
        {children}
      </span>
    </Component>
  );
}
