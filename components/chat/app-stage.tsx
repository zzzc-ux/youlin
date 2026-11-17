"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ActiveChatProvider } from "@/hooks/use-active-chat";
import { ChatShell } from "./shell";

export function AppStage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/forum")) {
    return children;
  }

  return (
    <ActiveChatProvider>
      <ChatShell />
    </ActiveChatProvider>
  );
}
