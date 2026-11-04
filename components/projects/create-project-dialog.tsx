"use client";

import * as React from "react";
import { AlertCircle, Plus } from "lucide-react";
import { useActionState } from "react";
import { createProjectAction } from "@/lib/actions/projects";
import { PROJECT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useNavigationProgress } from "@/components/layout/navigation-progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/lib/types";

export function CreateProjectDialog() {
  const [open, setOpen] = React.useState(false);
  const [color, setColor] = React.useState("blue");
  const [template, setTemplate] = React.useState<"default" | "blank">("default");
  const { start, finish } = useNavigationProgress();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    async (prevState, formData) => {
      start();
      const result = await createProjectAction(prevState, formData);
      // 创建成功会 redirect，await 会抛出并由 Next 处理，不在这里结束进度条。
      if (result) finish();
      return result;
    },
    null
  );

  // 页面被 Activity 隐藏时，关闭一次性弹窗并清空临时选择。
  // 成功创建后跳转由 createProjectAction 的 redirect 完成，客户端不再导航。
  React.useLayoutEffect(() => {
    return () => {
      setOpen(false);
      setColor("blue");
      setTemplate("default");
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          新建项目
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>
              创建一个看板，稍后可以邀请成员和自定义字段。
            </DialogDescription>
          </DialogHeader>

          {state && !state.ok ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="project-name">项目名称</Label>
            <Input
              id="project-name"
              name="name"
              placeholder="例如：产品迭代"
              autoFocus
              required
            />
            {state && !state.ok && state.fieldErrors?.name?.[0] ? (
              <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">描述</Label>
            <Textarea
              id="project-description"
              name="description"
              placeholder="可选"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>颜色</Label>
            <input type="hidden" name="color" value={color} />
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  title={item.label}
                  aria-label={item.label}
                  onClick={() => setColor(item.key)}
                  className={cn(
                    "size-7 rounded-full border-2 transition-transform hover:scale-110",
                    color === item.key
                      ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: item.hex }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>模板</Label>
            <input type="hidden" name="template" value={template} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTemplate("default")}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors",
                  template === "default"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="block font-medium">默认三列</span>
                <span className="text-xs text-muted-foreground">
                  待办 / 进行中 / 已完成
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTemplate("blank")}
                className={cn(
                  "rounded-lg border p-3 text-left text-sm transition-colors",
                  template === "blank"
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="block font-medium">空白</span>
                <span className="text-xs text-muted-foreground">
                  从零开始添加列
                </span>
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <SubmitButton pendingText="创建中...">创建项目</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
