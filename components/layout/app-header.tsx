"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import type { SessionUser } from "@/lib/types";

export function AppHeader({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
      <SidebarTrigger />
      <div className="min-w-0 flex-1 pl-1">
        <p className="truncate text-sm font-medium">轻看板</p>
      </div>
      <ThemeToggle />
      <UserMenu user={user} />
    </header>
  );
}
