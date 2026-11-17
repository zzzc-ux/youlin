"use client";

import { Aurora } from "./aurora";

/**
 * 蓝白背景：浅色天光渐变 + 蓝色极光。没有星点。
 * 极光着色参考 React Bits Aurora 的浅色用法，色标改成天蓝、钴蓝和近白。
 */
export function DaylightBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="daylight-backdrop pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="daylight-base absolute inset-0" />
      <div className="daylight-aurora absolute inset-x-0 top-0 h-[72%]">
        <Aurora
          colors={["#7dd3fc", "#2563eb", "#f0f9ff"]}
          height={0.38}
          intensity={1.15}
          speed={0.75}
        />
      </div>
      <div className="daylight-wash absolute inset-[-12%]" />
      <div className="daylight-grid absolute inset-0" />
    </div>
  );
}
