"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Aurora } from "./aurora";
import { Galaxy } from "./galaxy";
import { UniverseField } from "./universe-field";

type CosmicBackdropProps = {
  /** hero：登录页，星空和极光都更强；app：应用内，降低亮度保证文字可读 */
  variant?: "hero" | "app";
  className?: string;
};

/**
 * 全站宇宙背景：深空渐变 + 极光光幕 + 星河 + 暗角 + 颗粒。
 * 浏览器不支持 WebGL 时退回到 2D 画布星空。
 */
export function CosmicBackdrop({ variant = "app", className }: CosmicBackdropProps) {
  const [webgl, setWebgl] = useState(true);
  const hero = variant === "hero";

  return (
    <div
      aria-hidden="true"
      className={cn("cosmic-backdrop pointer-events-none overflow-hidden", className)}
      data-variant={variant}
    >
      <div className="cosmic-base absolute inset-0" />
      <div className="cosmic-nebula absolute inset-[-20%]" />

      {webgl ? (
        <>
          <div className="cosmic-aurora absolute inset-x-0 top-0 h-[78%]">
            <Aurora
              height={hero ? 0.5 : 0.58}
              intensity={hero ? 0.95 : 0.55}
              speed={hero ? 1 : 0.7}
            />
          </div>
          <div className="cosmic-stars absolute inset-0">
            <Galaxy
              brightness={hero ? 1.15 : 0.7}
              density={hero ? 0.6 : 0.42}
              glow={hero ? 1.1 : 0.8}
              onUnsupported={() => setWebgl(false)}
              repulsion={hero ? 2 : 1.2}
              speed={hero ? 1 : 0.6}
              twinkle={0.65}
            />
          </div>
        </>
      ) : (
        <UniverseField variant={hero ? "hero" : "soft"} />
      )}

      <div className="cosmic-vignette absolute inset-0" />
      <div className="cosmic-grain absolute inset-0" />
    </div>
  );
}
