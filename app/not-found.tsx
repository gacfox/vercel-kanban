import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">页面不存在</h1>
        <p className="text-sm text-muted-foreground">
          你访问的页面不存在，或者你没有权限查看。
        </p>
      </div>
      <Button asChild>
        <Link href="/projects">返回项目列表</Link>
      </Button>
    </div>
  );
}
