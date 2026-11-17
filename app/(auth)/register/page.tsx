"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { PRODUCT_NAME } from "@/lib/brand";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ description: "这个邮箱已经注册过了", type: "error" });
    } else if (state.status === "failed") {
      toast({ description: "注册失败，请稍后再试", type: "error" });
    } else if (state.status === "invalid_data") {
      toast({
        description: "请填写账号，密码至少 6 位",
        type: "error",
      });
    } else if (state.status === "success") {
      toast({ description: "注册成功", type: "success" });
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
      <h1 className="font-semibold text-[28px] text-slate-950 tracking-tight">创建账号</h1>
      <p className="mt-1 text-[14px] text-slate-500">注册后即可使用{PRODUCT_NAME}。</p>
      <AuthForm action={handleSubmit} defaultEmail={email}>
        <SubmitButton isSuccessful={isSuccessful}>注册</SubmitButton>
        <p className="text-center text-[13px] text-slate-500">
          {"已有账号？ "}
          <Link
            className="font-medium text-slate-950 underline-offset-4 hover:underline"
            href="/login"
          >
            去登录
          </Link>
        </p>
      </AuthForm>
    </>
  );
}
