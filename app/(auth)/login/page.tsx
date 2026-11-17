"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "failed") {
      toast({ description: "账号或密码不正确", type: "error" });
    } else if (state.status === "invalid_data") {
      toast({
        description: "请填写账号，密码至少 6 位",
        type: "error",
      });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <h1 className="font-semibold text-[28px] text-slate-950 tracking-tight">欢迎回来</h1>
      <p className="mt-1 text-[14px] text-slate-500">登录后，校园里的事都可以直接问我。</p>
      <AuthForm
        action={handleSubmit}
        defaultEmail={email}
      >
        <SubmitButton isSuccessful={isSuccessful}>登录</SubmitButton>
        <p className="text-center text-[13px] text-slate-500">
          {"还没有账号？ "}
          <Link
            className="font-medium text-slate-950 underline-offset-4 hover:underline"
            href="/register"
          >
            注册
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
