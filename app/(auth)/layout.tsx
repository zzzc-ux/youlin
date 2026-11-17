import { AuthSplit } from "@/components/chat/auth-split";
import { DaylightBackdrop } from "@/components/effects/daylight-backdrop";
import { LoginLanyard } from "@/components/effects/login-lanyard";
import { FadeIn } from "@/components/effects/text-effects";

/**
 * 登录在卡片右侧，注册时和左侧问题对调。
 * 吊牌挂在登录卡片左侧的空白处，画布全屏、点击穿透。
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="login-stage relative h-dvh w-screen overflow-hidden bg-[#f4f8ff] text-slate-900">
      <DaylightBackdrop />

      {/* 吊牌画布铺满全屏但不接收点击，拖动时不会被容器边界裁切 */}
      <div className="pointer-events-none absolute inset-0 z-30">
        <LoginLanyard />
      </div>

      <div className="pointer-events-none relative z-10 flex h-full items-center justify-center px-4 py-8">
        <FadeIn className="pointer-events-auto w-full max-w-[920px]" y={16}>
          <AuthSplit>{children}</AuthSplit>
          <p className="mt-5 text-center text-[12px] text-slate-500">
            校园信息问答 · 失物招领 · 办事指引 · 校园论坛
          </p>
        </FadeIn>
      </div>
    </div>
  );
}
