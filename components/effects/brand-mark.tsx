import { cn } from "@/lib/utils";

/**
 * 品牌标识：紫色渐变圆角方块，内含“对话气泡 + 学士帽”线条图标。
 * active 为 true 时外圈有呼吸光晕（例如助手正在回答）。
 */
export function BrandMark({
  size = 28,
  active = false,
  className,
}: {
  size?: number;
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-[#7c6cff] to-[#5b47e6] text-white shadow-[inset_0_1px_0_oklch(1_0_0/0.25),0_4px_14px_-4px_oklch(0.55_0.2_285/0.7)]",
        active && "brand-mark-active",
        className
      )}
      style={{ borderRadius: size * 0.3, height: size, width: size }}
    >
      <svg
        fill="none"
        height={size * 0.68}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.7}
        viewBox="0 0 24 24"
        width={size * 0.68}
      >
        {/* 对话气泡 */}
        <path d="M6 4.5h12a3 3 0 0 1 3 3v7.5a3 3 0 0 1-3 3h-5.2L8.5 21v-3H6a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3z" />
        {/* 学士帽 */}
        <path d="M12 8 7 10.3l5 2.3 5-2.3z" />
        <path d="M9.2 11.4v1.9c0 .6 1.25 1.2 2.8 1.2s2.8-.6 2.8-1.2v-1.9" />
      </svg>
    </span>
  );
}
