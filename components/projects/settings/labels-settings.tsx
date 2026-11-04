"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActionState } from "react";
import {
  createLabelAction,
  deleteLabelAction,
  updateLabelAction,
} from "@/lib/actions/board";
import { LABEL_COLORS, LABEL_COLOR_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { ColorPicker } from "@/components/shared/color-picker";
import { SubmitButton } from "@/components/shared/submit-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { ActionResult, Label as LabelType } from "@/lib/types";

export function LabelsSettings({
  projectId,
  labels,
  canManage,
  archived,
}: {
  projectId: string;
  labels: LabelType[];
  canManage: boolean;
  archived: boolean;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>标签</CardTitle>
          <CardDescription>
            标签用于分类和筛选卡片，可以给一张卡片添加多个标签。
          </CardDescription>
        </div>
        {canManage && !archived ? (
          <LabelCreateDialog projectId={projectId} onCreated={router.refresh} />
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {labels.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">还没有标签。</p>
          ) : (
            labels.map((label) => {
              const color = LABEL_COLOR_MAP[label.color] ?? LABEL_COLOR_MAP.slate;
              return (
                <div
                  key={label.id}
                  className="flex items-center gap-3 p-3"
                >
                  <span
                    className={cn(
                      "rounded px-2 py-1 text-xs font-medium",
                      color.className
                    )}
                  >
                    {label.name}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {canManage && !archived ? (
                      <>
                        <LabelEditDialog
                          projectId={projectId}
                          label={label}
                          onSaved={router.refresh}
                        />
                        <ConfirmAction
                          title="删除标签？"
                          description={`删除「${label.name}」会从所有卡片上移除该标签。`}
                          confirmLabel="删除"
                          destructive
                          onConfirm={async () => {
                            const result = await deleteLabelAction(
                              projectId,
                              label.id
                            );
                            if (!result.ok) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("标签已删除");
                            router.refresh();
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            aria-label="删除标签"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </ConfirmAction>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LabelCreateDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState("slate");
  const [, formAction] = useActionState<
    ActionResult<{ labelId: string }> | null,
    FormData
  >(async (prevState, formData) => {
    const result = await createLabelAction(prevState, formData);
    if (result.ok) {
      React.startTransition(() => setOpen(false));
      toast.success("标签已创建");
      onCreated();
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          添加标签
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>添加标签</DialogTitle>
            <DialogDescription>标签名称在项目内唯一。</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="color" value={color} />
          <div className="space-y-2">
            <Label htmlFor="label-name">标签名称</Label>
            <Input id="label-name" name="name" placeholder="例如：紧急" required />
          </div>
          <div className="space-y-2">
            <Label>颜色</Label>
            <ColorPicker colors={LABEL_COLORS} value={color} onChange={setColor} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <SubmitButton pendingText="创建中...">创建标签</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LabelEditDialog({
  projectId,
  label,
  onSaved,
}: {
  projectId: string;
  label: LabelType;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState(label.color);
  const [, formAction] = useActionState<ActionResult | null, FormData>(
    async (prevState, formData) => {
      const result = await updateLabelAction(prevState, formData);
      if (result.ok) {
        React.startTransition(() => setOpen(false));
        toast.success("标签已更新");
        onSaved();
      }
      return result;
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="编辑标签">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>编辑标签</DialogTitle>
            <DialogDescription>修改标签名称和颜色。</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="labelId" value={label.id} />
          <input type="hidden" name="color" value={color} />
          <div className="space-y-2">
            <Label htmlFor={`label-name-${label.id}`}>标签名称</Label>
            <Input
              id={`label-name-${label.id}`}
              name="name"
              defaultValue={label.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>颜色</Label>
            <ColorPicker colors={LABEL_COLORS} value={color} onChange={setColor} />
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
