"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  archiveProjectAction,
  deleteProjectAction,
  updateProjectAction,
} from "@/lib/actions/projects";
import { PROJECT_COLORS } from "@/lib/constants";
import { useNavigationProgress } from "@/components/layout/navigation-progress";
import { ColorPicker } from "@/components/shared/color-picker";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BoardProject } from "@/lib/types";

export function GeneralSettings({
  project,
  canManage,
}: {
  project: BoardProject;
  canManage: boolean;
}) {
  const router = useRouter();
  const { start, finish } = useNavigationProgress();
  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description);
  const [color, setColor] = React.useState(project.color);
  const [saving, setSaving] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState("");
  const archived = Boolean(project.archivedAt);

  React.useEffect(() => {
    setName(project.name);
    setDescription(project.description);
    setColor(project.color);
  }, [project.id, project.name, project.description, project.color]);

  async function save() {
    if (!canManage) return;
    setSaving(true);
    const formData = new FormData();
    formData.set("projectId", project.id);
    formData.set("name", name);
    formData.set("description", description);
    formData.set("color", color);
    const result = await updateProjectAction(null, formData);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("项目已保存");
    router.refresh();
  }

  async function toggleArchive() {
    const result = await archiveProjectAction(project.id, !archived);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(archived ? "项目已恢复" : "项目已归档");
    router.refresh();
  }

  async function removeProject() {
    start();
    const result = await deleteProjectAction(project.id, confirmName);
    // 删除成功会 redirect，await 会抛出并由 Next 处理，不在这里结束进度条。
    finish();
    if (!result.ok) toast.error(result.error);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>项目名称、描述和颜色。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {archived ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              项目已归档，编辑功能不可用。恢复后可继续修改。
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="settings-name">项目名称</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canManage || archived}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-description">描述</Label>
            <Textarea
              id="settings-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              disabled={!canManage || archived}
            />
          </div>

          <div className="space-y-2">
            <Label>颜色</Label>
            <ColorPicker
              colors={PROJECT_COLORS}
              value={color}
              onChange={setColor}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!canManage || archived || saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>危险操作</CardTitle>
            <CardDescription>归档或彻底删除项目。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void toggleArchive()}
            >
              {archived ? (
                <RotateCcw className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
              {archived ? "恢复项目" : "归档项目"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="size-4" />
                  彻底删除项目
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>彻底删除项目？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作不可恢复，项目内的列、卡片、评论、标签、字段和自动化都会被删除。
                    请输入项目名称 <strong>{project.name}</strong> 确认。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={confirmName}
                  onChange={(event) => setConfirmName(event.target.value)}
                  placeholder={project.name}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setConfirmName("")}>
                    取消
                  </AlertDialogCancel>
                  <Button
                    variant="destructive"
                    disabled={confirmName.trim() !== project.name}
                    onClick={() => void removeProject()}
                  >
                    删除
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
