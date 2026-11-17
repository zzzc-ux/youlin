"use client";

import {
  type ComponentProps,
  type PointerEvent,
  useCallback,
  useRef,
} from "react";
import { cn } from "@/lib/utils";

type SpotlightCardProps = ComponentProps<"div"> & {
  /** 聚光颜色（建议带透明度） */
  spotlight?: string;
  /** 鼠标附近的边框是否也一起发光 */
  borderGlow?: boolean;
  /** 悬停时轻微 3D 倾斜 */
  tilt?: boolean;
};

/**
 * 聚光卡片：鼠标所到之处出现柔和光斑，边框跟随发光，可选轻微倾斜。
 */
export function SpotlightCard({
  className,
  children,
  spotlight = "oklch(0.78 0.16 285 / 0.22)",
  borderGlow = true,
  tilt = false,
  onPointerMove,
  onPointerLeave,
  style,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        el.style.setProperty("--spot-x", `${x}px`);
        el.style.setProperty("--spot-y", `${y}px`);
        el.style.setProperty("--spot-o", "1");
        if (tilt) {
          const rx = ((y / rect.height) - 0.5) * -6;
          const ry = ((x / rect.width) - 0.5) * 6;
          el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
        }
      }
      onPointerMove?.(event);
    },
    [onPointerMove, tilt]
  );

  const handleLeave = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (el) {
        el.style.setProperty("--spot-o", "0");
        if (tilt) {
          el.style.transform = "";
        }
      }
      onPointerLeave?.(event);
    },
    [onPointerLeave, tilt]
  );

  return (
    <div
      className={cn(
        "spotlight-card group/spot relative isolate overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color,background-color] duration-300 ease-out",
        className
      )}
      onPointerLeave={handleLeave}
      onPointerMove={handleMove}
      ref={ref}
      style={{ "--spot-color": spotlight, ...style } as React.CSSProperties}
      {...props}
    >
      <div className="spotlight-fill pointer-events-none absolute inset-0 -z-10" />
      {borderGlow ? <div className="spotlight-border pointer-events-none absolute inset-0 rounded-[inherit]" /> : null}
      {children}
    </div>
  );
}
