"use client";

import {
  MessagesSquareIcon,
  PanelLeftIcon,
  PenSquareIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import { BrandMark } from "@/components/effects/brand-mark";
import { ShinyText } from "@/components/effects/text-effects";
import { PRODUCT_NAME } from "@/lib/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const closeMobile = useCallback(() => {
    setOpenMobile(false);
  }, [setOpenMobile]);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const handleNewChat = useCallback(() => {
    setOpenMobile(false);
    router.push("/");
  }, [router, setOpenMobile]);

  const handleShowDeleteAllDialog = useCallback(() => {
    setShowDeleteAllDialog(true);
  }, []);

  const handleDeleteAll = useCallback(() => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], {
      revalidate: false,
    });

    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
      method: "DELETE",
    });

    toast.success("已删除全部对话");
  }, [mutate, router]);

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="pb-0 pt-3">
          <SidebarMenu>
            <SidebarMenuItem className="flex flex-row items-center justify-between">
              <div className="group/logo relative flex items-center justify-center">
                <SidebarMenuButton
                  asChild
                  className="size-8 !px-0 items-center justify-center group-data-[collapsible=icon]:group-hover/logo:opacity-0"
                  tooltip={PRODUCT_NAME}
                >
                  <Link aria-label={PRODUCT_NAME} href="/" onClick={closeMobile}>
                    <BrandMark size={22} />
                  </Link>
                </SidebarMenuButton>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100"
                      onClick={handleToggleSidebar}
                    >
                      <PanelLeftIcon className="size-4" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent className="hidden md:block" side="right">
                    展开侧边栏
                  </TooltipContent>
                </Tooltip>
              </div>
              <ShinyText className="mr-auto ml-1.5 font-semibold text-[14px] tracking-wide group-data-[collapsible=icon]:hidden">
                {PRODUCT_NAME}
              </ShinyText>
              <div className="group-data-[collapsible=icon]:hidden">
                <SidebarTrigger className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground" />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="pt-1">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="h-9 rounded-xl border border-violet-300/20 bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-fuchsia-500/10 text-[13px] text-sidebar-foreground transition-all duration-200 hover:border-violet-300/40 hover:from-indigo-500/30 hover:via-violet-500/25 hover:shadow-[0_8px_24px_-10px_oklch(0.6_0.22_290/0.7)] group-data-[collapsible=icon]:border-0 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                    isActive={pathname.startsWith("/forum")}
                    tooltip="论坛"
                  >
                    <Link href="/forum" onClick={closeMobile}>
                      <MessagesSquareIcon className="size-4" />
                      <span className="font-medium">论坛</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="h-9 rounded-xl border border-violet-300/20 bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-fuchsia-500/10 text-[13px] text-sidebar-foreground transition-all duration-200 hover:border-violet-300/40 hover:from-indigo-500/30 hover:via-violet-500/25 hover:shadow-[0_8px_24px_-10px_oklch(0.6_0.22_290/0.7)] group-data-[collapsible=icon]:border-0"
                    onClick={handleNewChat}
                    tooltip="新对话"
                  >
                    <PenSquareIcon className="size-4" />
                    <span className="font-medium">新对话</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="h-9 rounded-xl border border-violet-300/20 bg-gradient-to-r from-indigo-500/20 via-violet-500/15 to-fuchsia-500/10 text-[13px] text-sidebar-foreground transition-all duration-200 hover:border-violet-300/40 hover:from-indigo-500/30 hover:via-violet-500/25 hover:shadow-[0_8px_24px_-10px_oklch(0.6_0.22_290/0.7)] group-data-[collapsible=icon]:border-0"
                      onClick={handleShowDeleteAllDialog}
                      tooltip="删除全部对话"
                    >
                      <TrashIcon className="size-4" />
                      <span className="font-medium">删除全部</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border pt-2 pb-3">
          {user ? <SidebarUserNav user={user} /> : null}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除全部对话？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销，会删除你在本机的全部聊天记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              全部删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
