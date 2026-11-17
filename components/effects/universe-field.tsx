"use client";

import { useEffect, useRef } from "react";

type UniverseFieldProps = {
  variant?: "hero" | "soft";
};

type Star = {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  speed: number;
};

type Streak = {
  x: number;
  y: number;
  length: number;
  speed: number;
  life: number;
};

export function UniverseField({ variant = "hero" }: UniverseFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0.5, y: 0.42 };
    let stars: Star[] = [];
    let streaks: Streak[] = [];
    let frame = 0;
    let width = 1;
    let height = 1;

    const seedStars = () => {
      const density = variant === "hero" ? 7000 : 11000;
      const count = Math.min(variant === "hero" ? 260 : 140, Math.floor((width * height) / density));
      stars = Array.from({ length: Math.max(count, 48) }, () => ({
        phase: Math.random() * Math.PI * 2,
        size: Math.random() * (variant === "hero" ? 1.7 : 1.25) + 0.35,
        speed: 0.15 + Math.random() * 0.55,
        x: Math.random(),
        y: Math.random(),
        z: Math.random(),
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      seedStars();
    };

    const onPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) / rect.width;
      pointer.y = (event.clientY - rect.top) / rect.height;
    };

    const draw = (time: number) => {
      const dark = document.documentElement.classList.contains("dark") || variant === "hero";
      context.clearRect(0, 0, width, height);

      const drift = reduced ? 0 : time * 0.000012;
      for (const star of stars) {
        const depth = 0.35 + star.z * 0.65;
        const parallaxX = (pointer.x - 0.5) * 28 * star.z;
        const parallaxY = (pointer.y - 0.5) * 18 * star.z;
        const x = ((star.x + drift * star.speed) % 1) * width + parallaxX;
        const y = ((star.y + Math.sin(time * 0.00015 + star.phase) * 0.004) % 1) * height + parallaxY;
        const twinkle = reduced ? 0.75 : 0.45 + Math.sin(time * 0.002 * star.speed + star.phase) * 0.4;
        context.beginPath();
        context.fillStyle = dark
          ? `rgba(236, 244, 255, ${0.25 + twinkle * depth})`
          : `rgba(67, 78, 140, ${0.12 + twinkle * 0.22})`;
        context.arc(x, y, star.size * depth, 0, Math.PI * 2);
        context.fill();
      }

      if (variant === "hero" && !reduced && Math.random() < 0.008 && streaks.length < 3) {
        streaks.push({
          length: 70 + Math.random() * 90,
          life: 1,
          speed: 7 + Math.random() * 5,
          x: Math.random() * width * 0.8,
          y: Math.random() * height * 0.45,
        });
      }

      streaks = streaks.filter((streak) => streak.life > 0);
      for (const streak of streaks) {
        streak.x += streak.speed;
        streak.y += streak.speed * 0.38;
        streak.life -= 0.012;
        const gradient = context.createLinearGradient(
          streak.x,
          streak.y,
          streak.x - streak.length,
          streak.y - streak.length * 0.38
        );
        gradient.addColorStop(0, `rgba(255,255,255,${streak.life})`);
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.strokeStyle = gradient;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(streak.x, streak.y);
        context.lineTo(streak.x - streak.length, streak.y - streak.length * 0.38);
        context.stroke();
      }

      frame = window.requestAnimationFrame(draw);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("pointermove", onPointer);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
    };
  }, [variant]);

  return (
    <div
      aria-hidden="true"
      className="universe-scene pointer-events-none absolute inset-0 overflow-hidden"
      data-variant={variant}
    >
      <div className="universe-aurora" />
      <canvas className="absolute inset-0 size-full" ref={canvasRef} />
      <div className="universe-vignette" />
    </div>
  );
}
