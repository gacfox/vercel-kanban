"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useActionState } from "react";
import {
  deleteColumnAction,
  reorderColumnAction,
  updateColumnAction,
} from "@/lib/actions/board";
import { ColumnDialog } from "@/components/board/column-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult, BoardColumn } from "@/lib/types";

export function ColumnsSettings({
  projectId,
  columns,
  canManage,
  archived,
}: {
  projectId: string;
  columns: BoardColumn[];
  canManage: boolean;
  archived: boolean;
}) {
  const router = useRouter();

  async function move(column: BoardColumn, direction: -1 | 1) {
    const index = columns.findIndex((item) => item.id === column.id);
    const neighbor = columns[index + direction];
    if (!neighbor) return;

    const result = await reorderColumnAction(
      projectId,
      column.id,
      direction === -1 ? neighbor.id : null,
      direction === 1 ? neighbor.id : null
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>看板列</CardTitle>
          <CardDescription>
            调整顺序、WIP 上限和列历史显示窗口（例如 Done 列最近 30 天）。
          </CardDescription>
        </div>
        {canManage && !archived ? <ColumnDialog projectId={projectId} /> : null}
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {columns.map((column, index) => (
            <div
              key={column.id}
              className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{column.title}</p>
                  <span className="text-xs text-muted-foreground">
                    位置 {index + 1}
                  </span>
                  {column.isDone ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      完成列
                    </span>
                  ) : null}
                  {column.wipLimit != null ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      WIP {column.wipLimit}
                    </span>
                  ) : null}
                  {column.historyWindowDays != null ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      最近 {column.historyWindowDays} 天
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {column.totalCount} 张卡片
                </p>
              </div>

              {canManage && !archived ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === 0}
                    onClick={() => void move(column, -1)}
                    aria-label="上移"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={index === columns.length - 1}
                    onClick={() => void move(column, 1)}
                    aria-label="下移"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <ColumnEditDialog
                    projectId={projectId}
                    column={column}
                    onSaved={router.refresh}
                  />
                  <ColumnDeleteDialog
                    projectId={projectId}
                    column={column}
                    columns={columns}
                    onDeleted={() => router.refresh()}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ColumnEditDialog({
  projectId,
  column,
  onSaved,
}: {
  projectId: string;
  column: BoardColumn;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateColumnAction,
    null
  );

  React.useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      toast.success("列已更新");
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="编辑列">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>编辑列</DialogTitle>
            <DialogDescription>
              WIP 上限和历史窗口留空表示不限制。
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="columnId" value={column.id} />
          <div className="space-y-2">
            <Label htmlFor={`column-title-${column.id}`}>列名称</Label>
            <Input
              id={`column-title-${column.id}`}
              name="title"
              defaultValue={column.title}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`column-wip-${column.id}`}>WIP 上限</Label>
              <Input
                id={`column-wip-${column.id}`}
                name="wipLimit"
                type="number"
                min={1}
                max={9999}
                defaultValue={column.wipLimit ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`column-history-${column.id}`}>
                历史显示窗口（天）
              </Label>
              <Input
                id={`column-history-${column.id}`}
                name="historyWindowDays"
                type="number"
                min={1}
                max={3650}
                defaultValue={column.historyWindowDays ?? ""}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`column-done-${column.id}`}
              name="isDone"
              defaultChecked={column.isDone}
            />
            <Label htmlFor={`column-done-${column.id}`} className="font-normal">
              标记为完成列
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <SubmitButton pendingText="保存中...">保存</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColumnDeleteDialog({
  projectId,
  column,
  columns,
  onDeleted,
}: {
  projectId: string;
  column: BoardColumn;
  columns: BoardColumn[];
  onDeleted: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [strategy, setStrategy] = React.useState<"move" | "archive">("move");
  const [target, setTarget] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const otherColumns = columns.filter((item) => item.id !== column.id);
  const canDelete = columns.length > 1;

  async function remove() {
    if (strategy === "move" && !target) {
      toast.error("请选择目标列");
      return;
    }
    setPending(true);
    const result = await deleteColumnAction(
      projectId,
      column.id,
      strategy,
      strategy === "move" ? target : null
    );
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setOpen(false);
    toast.success("列已删除");
    onDeleted();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          aria-label="删除列"
          disabled={!canDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除「{column.title}」</DialogTitle>
          <DialogDescription>
            该列有 {column.totalCount} 张卡片。请选择如何处理这些卡片。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>处理方式</Label>
            <Select
              value={strategy}
              onValueChange={(value) => setStrategy(value as "move" | "archive")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="move">移动到其他列</SelectItem>
                <SelectItem value="archive">归档所有卡片</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {strategy === "move" ? (
            <div className="space-y-2">
              <Label>目标列</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="选择目标列" />
                </SelectTrigger>
                <SelectContent>
                  {otherColumns.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => void remove()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            删除列
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
