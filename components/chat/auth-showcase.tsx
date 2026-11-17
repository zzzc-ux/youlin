"use client";

import { Quote, ShieldCheck, Sparkles } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  BlurText,
  FadeIn,
  GradientText,
  RotatingText,
} from "@/components/effects/text-effects";

const cards = [
  {
    code: "QA-01-CAMPUS",
    details: [
      ["来源", "标注出处"],
      ["范围", "校历讲座"],
      ["方式", "直接提问"],
      ["结果", "带来源"],
    ],
    seat: "01",
    subtitle: "奖学金、请假、讲座和校历，回答会标出来源。",
    title: "校园问答",
    type: "问答",
  },
  {
    code: "LF-02-CAMPUS",
    details: [
      ["登记", "说清物品"],
      ["地点", "最后出现"],
      ["匹配", "自动对照"],
      ["闭环", "找回关闭"],
    ],
    seat: "02",
    subtitle: "说清物品和地点，就能登记、匹配，找回后关闭。",
    title: "失物招领",
    type: "招领",
  },
  {
    code: "GD-03-CAMPUS",
    details: [
      ["材料", "逐项列出"],
      ["窗口", "去哪办理"],
      ["步骤", "下一步"],
      ["事项", "补卡认定"],
    ],
    seat: "03",
    subtitle: "补卡、困难认定会列出材料、窗口和下一步。",
    title: "办事指引",
    type: "办事",
  },
  {
    code: "FM-04-CAMPUS",
    details: [
      ["发帖", "活动社团"],
      ["查找", "对话检索"],
      ["分类", "讲座招新"],
      ["互助", "同学发布"],
    ],
    seat: "04",
    subtitle: "同学发布活动、社团和互助帖，对话里也能查找。",
    title: "校园论坛",
    type: "论坛",
  },
];

const questions = [
  "奖学金怎么申请？",
  "校园卡丢了怎么办？",
  "这周有什么讲座？",
  "今天食堂吃什么？",
  "请假要走什么流程？",
];

const promises = [
  { icon: Quote, text: "回答标注出处" },
  { icon: ShieldCheck, text: "查不到不编造" },
  { icon: Sparkles, text: "全天随时可问" },
];

export function AuthShowcase() {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="m-auto w-full px-6 py-6 2xl:px-10">
        <FadeIn delay={0.1}>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[12px] text-sky-800">
            <span className="size-1.5 animate-pulse rounded-full bg-sky-500 shadow-[0_0_10px_2px_rgba(56,189,248,0.55)]" />
            校园生活
          </span>
        </FadeIn>

        <h2 className="mt-4 font-semibold text-[32px] text-slate-900 leading-[1.15] tracking-tight 2xl:text-[40px]">
          <BlurText delay={0.2} text="把分散的校园事务" />
          <br />
          <GradientText
            className="inline-block"
            colors={["#0284c7", "#2563eb", "#38bdf8", "#0284c7"]}
          >
            <BlurText delay={0.55} text="收成一次对话" />
          </GradientText>
        </h2>

        <FadeIn delay={0.9}>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-4 py-2 text-[15px] text-slate-600 shadow-sm">
            试着问我：
            <RotatingText className="font-medium text-sky-800" texts={questions} />
          </p>
        </FadeIn>

        <div className="mt-2 grid grid-cols-2 justify-items-center">
          {cards.map((card, index) => (
            <FadeIn delay={1 + index * 0.12} key={card.title}>
              <div className="ticket-canvas">
                <div className="ticket-wrapper">
                  <div className="ticket">
                    <div className="t-main">
                      <div className="t-content">
                        <div className="t-header">
                          <div className="t-logo">
                            <svg viewBox="0 0 24 24">
                              <path
                                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                              />
                            </svg>
                            {PRODUCT_NAME}
                          </div>
                          <div className="t-type">{card.type}</div>
                        </div>
                        <div className="t-title">{card.title}</div>
                        <div className="t-subtitle">{card.subtitle}</div>
                        <div className="t-details">
                          {card.details.map(([label, value]) => (
                            <div className="t-detail-item" key={label}>
                              <span className="t-label">{label}</span>
                              <span className="t-value">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div
                        className="t-perforation"
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          width: "100%",
                          transform: "translateY(50%)",
                        }}
                      >
                        <div className="t-perf-line" />
                      </div>
                    </div>
                    <div className="t-stub">
                      <div className="t-barcode-container">
                        <div className="t-barcode" />
                        <div className="t-barcode-id">{card.code}</div>
                      </div>
                      <div className="t-admit">
                        <div className="t-admit-text">Seat</div>
                        <div className="t-admit-num">{card.seat}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={1.6}>
          <div className="mt-2 inline-flex flex-wrap gap-6 rounded-full border border-sky-200 bg-white/85 px-5 py-3 text-[13px] text-slate-600 shadow-sm">
            {promises.map(({ icon: Icon, text }) => (
              <span className="inline-flex items-center gap-2" key={text}>
                <Icon className="size-4 text-sky-600" />
                {text}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
