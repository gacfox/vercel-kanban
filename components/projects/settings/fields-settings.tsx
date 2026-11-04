"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useActionState } from "react";
import {
  createFieldAction,
  deleteFieldAction,
  updateFieldAction,
} from "@/lib/actions/board";
import { FIELD_TYPES, FIELD_TYPE_MAP } from "@/lib/constants";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { SubmitButton } from "@/components/shared/submit-button";
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
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult, CustomField } from "@/lib/types";

export function FieldsSettings({
  projectId,
  fields,
  canManage,
  archived,
}: {
  projectId: string;
  fields: CustomField[];
  canManage: boolean;
  archived: boolean;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>自定义字段</CardTitle>
          <CardDescription>
            为项目定义额外属性，例如“客户”“预估工时”“上线日期”。
          </CardDescription>
        </div>
        {canManage && !archived ? (
          <FieldCreateDialog projectId={projectId} onCreated={router.refresh} />
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-lg border">
          {fields.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">还没有自定义字段。</p>
          ) : (
            fields.map((field) => (
              <div
                key={field.id}
                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{field.name}</p>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {FIELD_TYPE_MAP[field.type]?.label ?? field.type}
                    </span>
                    {field.showOnCard ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        卡片正面显示
                      </span>
                    ) : null}
                  </div>
                  {field.options.length > 0 ? (
                    <p className="truncate text-xs text-muted-foreground">
                      选项：{field.options.join("、")}
                    </p>
                  ) : null}
                </div>
                {canManage && !archived ? (
                  <div className="flex items-center gap-1">
                    <FieldEditDialog
                      projectId={projectId}
                      field={field}
                      onSaved={router.refresh}
                    />
                    <ConfirmAction
                      title="删除字段？"
                      description={`删除「${field.name}」会同时删除所有卡片的该字段值，且不可恢复。`}
                      confirmLabel="删除"
                      destructive
                      onConfirm={async () => {
                        const result = await deleteFieldAction(projectId, field.id);
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("字段已删除");
                        router.refresh();
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label="删除字段"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </ConfirmAction>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FieldCreateDialog({
  projectId,
  onCreated,
}: {
  projectId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState("text");
  const [, formAction] = useActionState<
    ActionResult<{ fieldId: string }> | null,
    FormData
  >(async (prevState, formData) => {
    const result = await createFieldAction(prevState, formData);
    if (result.ok) {
      React.startTransition(() => setOpen(false));
      toast.success("字段已创建");
      onCreated();
    }
    return result;
  }, null);

  const needsOptions = type === "select" || type === "multi_select";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          添加字段
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>添加自定义字段</DialogTitle>
            <DialogDescription>字段类型创建后不可修改。</DialogDescription>
          </DialogHeader>
          <input type="hidden" name="projectId" value={projectId} />
          <div className="space-y-2">
            <Label htmlFor="field-name">字段名称</Label>
            <Input id="field-name" name="name" placeholder="例如：客户" required />
          </div>
          <div className="space-y-2">
            <Label>类型</Label>
            <input type="hidden" name="type" value={type} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOptions ? (
            <div className="space-y-2">
              <Label htmlFor="field-options">选项</Label>
              <Textarea
                id="field-options"
                name="options"
                rows={4}
                placeholder="每行一个选项，例如：&#10;高&#10;中&#10;低"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Checkbox id="field-show" name="showOnCard" />
            <Label htmlFor="field-show" className="font-normal">
              在卡片正面显示
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <SubmitButton pendingText="创建中...">创建字段</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldEditDialog({
  projectId,
  field,
  onSaved,
}: {
  projectId: string;
  field: CustomField;
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [, formAction] = useActionState<ActionResult | null, FormData>(
    async (prevState, formData) => {
      const result = await updateFieldAction(prevState, formData);
      if (result.ok) {
        React.startTransition(() => setOpen(false));
        toast.success("字段已更新");
        onSaved();
      }
      return result;
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="编辑字段">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>编辑字段</DialogTitle>
            <DialogDescription>
              类型不可修改；选项变更不会自动迁移已有值。
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="fieldId" value={field.id} />
          <div className="space-y-2">
            <Label htmlFor={`field-name-${field.id}`}>字段名称</Label>
            <Input
              id={`field-name-${field.id}`}
              name="name"
              defaultValue={field.name}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>类型</Label>
            <Input value={FIELD_TYPE_MAP[field.type]?.label ?? field.type} disabled />
          </div>
          {field.type === "select" || field.type === "multi_select" ? (
            <div className="space-y-2">
              <Label htmlFor={`field-options-${field.id}`}>选项</Label>
              <Textarea
                id={`field-options-${field.id}`}
                name="options"
                rows={4}
                defaultValue={field.options.join("\n")}
              />
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Checkbox
              id={`field-show-${field.id}`}
              name="showOnCard"
              defaultChecked={field.showOnCard}
            />
            <Label htmlFor={`field-show-${field.id}`} className="font-normal">
              在卡片正面显示
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
