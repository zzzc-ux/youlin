"use client";

import { Eye, EyeOff } from "lucide-react";
import Form from "next/form";
import { useState } from "react";

import { Input } from "../ui/input";
import { Label } from "../ui/label";

const inputClass =
  "h-11 rounded-none border-0 border-b border-slate-200 bg-transparent px-0 text-[15px] text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:border-slate-900 focus-visible:ring-0";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  defaultPassword = "",
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  defaultPassword?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Form action={action} className="mt-7 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label className="font-medium text-[13px] text-slate-900" htmlFor="email">
          账号
        </Label>
        <Input
          autoComplete="username"
          autoFocus
          className={inputClass}
          defaultValue={defaultEmail}
          id="email"
          name="email"
          placeholder="请输入账号"
          required
          type="text"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="font-medium text-[13px] text-slate-900" htmlFor="password">
          密码
        </Label>
        <div className="relative">
          <Input
            className={`${inputClass} pr-8`}
            defaultValue={defaultPassword}
            id="password"
            name="password"
            placeholder="请输入密码"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            className="absolute top-1/2 right-0 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            onClick={() => setShowPassword((value) => !value)}
            type="button"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {children}
    </Form>
  );
}
