"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">页面出错了</h1>
        <p className="text-sm text-muted-foreground">
          请稍后重试；如果问题持续存在，请联系管理员。
        </p>
      </div>
      <Button onClick={reset}>重试</Button>
    </div>
  );
}
