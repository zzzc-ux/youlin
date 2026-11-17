"use client";

import { useEffect, useRef } from "react";

type Spark = { x: number; y: number; angle: number; start: number; hue: number };

/**
 * 全局点击火花：在页面任意位置点击，迸出一圈短促的光线。
 * 画布覆盖全屏且不拦截鼠标事件；没有火花时不占用动画帧。
 */
export function ClickSpark({
  count = 10,
  radius = 22,
  size = 10,
  duration = 450,
}: {
  count?: number;
  radius?: number;
  size?: number;
  duration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!(canvas && ctx)) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    let sparks: Spark[] = [];
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const easeOut = (t: number) => t * (2 - t);

    const draw = (now: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      sparks = sparks.filter((s) => now - s.start < duration);
      for (const s of sparks) {
        const t = easeOut((now - s.start) / duration);
        const dist = t * radius;
        const len = size * (1 - t);
        const x1 = s.x + dist * Math.cos(s.angle);
        const y1 = s.y + dist * Math.sin(s.angle);
        const x2 = s.x + (dist + len) * Math.cos(s.angle);
        const y2 = s.y + (dist + len) * Math.sin(s.angle);
        ctx.strokeStyle = `hsla(${s.hue}, 95%, 78%, ${1 - t})`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      frame = sparks.length > 0 ? requestAnimationFrame(draw) : 0;
    };

    const onClick = (event: MouseEvent) => {
      const now = performance.now();
      const baseHue = 250 + Math.random() * 60;
      for (let i = 0; i < count; i++) {
        sparks.push({
          angle: (2 * Math.PI * i) / count,
          hue: baseHue + (i % 3) * 18,
          start: now,
          x: event.clientX,
          y: event.clientY,
        });
      }
      if (!frame) {
        frame = requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", onClick);
    };
  }, [count, duration, radius, size]);

  return (
    <canvas
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[100] size-full"
      ref={canvasRef}
    />
  );
}
