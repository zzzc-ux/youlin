"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { PRODUCT_NAME } from "@/lib/brand";

const Lanyard = dynamic(() => import("./lanyard"), { ssr: false });

function drawCampusCard() {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 1125;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#f8fbff";
  ctx.fillRect(0, 0, 800, 1125);

  const band = ctx.createLinearGradient(0, 0, 800, 280);
  band.addColorStop(0, "#0284c7");
  band.addColorStop(1, "#2563eb");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, 800, 280);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 54px sans-serif";
  ctx.fillText(PRODUCT_NAME, 64, 150);
  ctx.font = "500 28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.fillText("CAMPUS PASS", 64, 204);

  ctx.fillStyle = "#0f172a";
  ctx.font = "700 64px sans-serif";
  ctx.fillText("访客", 64, 460);
  ctx.fillStyle = "#64748b";
  ctx.font = "500 32px sans-serif";
  ctx.fillText("在线问答 · 失物招领", 64, 530);
  ctx.fillText("办事指引 · 校园论坛", 64, 582);

  ctx.strokeStyle = "#dbeafe";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 660);
  ctx.lineTo(736, 660);
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 24px sans-serif";
  ctx.fillText("编号", 64, 740);
  ctx.fillStyle = "#1e293b";
  ctx.font = "700 36px sans-serif";
  ctx.fillText("XY-123456", 64, 792);

  ctx.fillStyle = "#e0f2fe";
  for (let i = 0; i < 28; i += 1) {
    const w = i % 3 === 0 ? 8 : 4;
    ctx.fillRect(64 + i * 22, 900, w, 90);
  }

  return canvas.toDataURL("image/png");
}

/** 登录卡片的最大宽度，与 AuthSplit 保持一致 */
const AUTH_CARD_WIDTH = 920;
/** 吊牌卡片在屏幕上的目标高度（像素） */
const CARD_HEIGHT_PX = 300;

type Frame = { anchor: number; size: number };

/** 把挂点放在登录卡片左侧空白的正中；空白太窄时返回 null（不显示吊牌，避免盖住表单） */
function computeFrame(): Frame | null {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gutter = (vw - AUTH_CARD_WIDTH) / 2;
  if (gutter < 250) {
    return null;
  }
  return {
    anchor: gutter / 2 / vw,
    size: Math.min(0.5, Math.max(0.2, CARD_HEIGHT_PX / vh)),
  };
}

/**
 * 登录页吊牌。画布铺满整个页面（拖到哪里都不会被裁切），
 * 开启 passThrough：空白处的点击交给下面的表单，只有点中吊牌才拖动。
 * 卡面图案依赖 document，只能在浏览器里生成，所以放在 useEffect 中。
 */
export function LoginLanyard() {
  const [card, setCard] = useState("");
  const [frame, setFrame] = useState<Frame | null>(null);

  useEffect(() => {
    setCard(drawCampusCard());
    const update = () => setFrame(computeFrame());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (!(card && frame)) {
    return null;
  }

  return (
    <Lanyard
      anchor={frame.anchor}
      breeze={0.12}
      cardColor="#f8fbff"
      finish="glossy"
      frontImage={card}
      gravity={1}
      interactive
      metal="silver"
      passThrough
      size={frame.size}
      strapColor="#2563eb"
      strapLength={0.35}
      strapWidth={0.55}
    />
  );
}
