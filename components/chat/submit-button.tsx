"use client";

import { useFormStatus } from "react-dom";

import { LoaderIcon } from "@/components/chat/icons";

export function SubmitButton({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending || isSuccessful}
      className="relative mt-1 h-11 w-full rounded-lg bg-neutral-950 font-medium text-[15px] text-white hover:bg-neutral-800 disabled:opacity-80"
      disabled={pending || isSuccessful}
      type={pending ? "button" : "submit"}
    >
      {children}

      {pending || isSuccessful ? (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      ) : null}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? "处理中" : "提交"}
      </output>
    </button>
  );
}
