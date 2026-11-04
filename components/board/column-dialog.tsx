"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus } from "lucide-react";
import { useActionState } from "react";
import { createColumnAction } from "@/lib/actions/board";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/lib/types";

export function ColumnDialog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<
    ActionResult<{ columnId: string }> | null,
    FormData
  >(async (prevState, formData) => {
    const result = await createColumnAction(prevState, formData);
    if (result.ok) {
      React.startTransition(() => setOpen(false));
      router.refresh();
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" />
          添加列
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>添加列</DialogTitle>
            <DialogDescription>
              列是看板中的一个阶段，可以设置 WIP 上限和历史显示窗口。
            </DialogDescription>
          </DialogHeader>

          {state && !state.ok ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <input type="hidden" name="projectId" value={projectId} />

          <div className="space-y-2">
            <Label htmlFor="column-title">列名称</Label>
            <Input id="column-title" name="title" placeholder="例如：待办" required autoFocus />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="column-wip">WIP 上限</Label>
              <Input
                id="column-wip"
                name="wipLimit"
                type="number"
                min={1}
                max={9999}
                placeholder="不限制"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="column-history">历史显示窗口（天）</Label>
              <Input
                id="column-history"
                name="historyWindowDays"
                type="number"
                min={1}
                max={3650}
                placeholder="不限制"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="column-done" name="isDone" />
            <Label htmlFor="column-done" className="font-normal">
              标记为完成列（用于统计与到期判断）
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <SubmitButton pendingText="创建中...">创建列</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
