"use client";

import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/effects/brand-mark";
import { PRODUCT_NAME } from "@/lib/brand";

const questions = [
  "奖学金怎么申请？",
  "校园卡丢了怎么办？",
  "这周有什么讲座？",
  "请假要走什么流程？",
];

export function AuthSplit({ children }: { children: React.ReactNode }) {
  const register = usePathname().includes("/register");

  return (
    <div className="grid w-full max-w-[920px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-36px_rgba(15,23,42,0.35)] md:min-h-[520px] md:grid-cols-2">
      <aside
        className={`flex flex-col justify-center bg-[#f3f5fb] px-8 py-10 ${register ? "md:order-2" : "md:order-1"}`}
      >
        <p className="text-[12px] text-slate-500 tracking-wide">在这里，从一个问题开始</p>
        <h2 className="mt-2 font-semibold text-[26px] text-slate-950 leading-snug">
          校园里的事，
          <br />
          一起解决。
        </h2>
        <ul className="mt-6 flex flex-col gap-3">
          {questions.map((question) => (
            <li
              className="rounded-2xl bg-white px-4 py-3 text-[14px] text-slate-700 shadow-sm"
              key={question}
            >
              {question}
            </li>
          ))}
        </ul>
      </aside>

      <div className={`px-8 py-9 sm:px-10 ${register ? "md:order-1" : "md:order-2"}`}>
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={36} />
          <span className="font-semibold text-[18px] tracking-tight text-slate-950">{PRODUCT_NAME}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
