import * as React from "react";
import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function AuthShell({
  siteName,
  title,
  description,
  children,
  wide = false,
}: {
  siteName: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative flex min-h-svh flex-col">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KanbanSquare className="size-4" />
          </span>
          <span>{siteName}</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
          <div className="mb-6 space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="rounded-xl border bg-card p-6 shadow-sm">{children}</div>
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-muted-foreground">
        轻量级项目与任务看板
      </footer>
    </div>
  );
}
