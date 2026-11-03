"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addMemberAction,
  removeMemberAction,
  transferOwnerAction,
  updateMemberRoleAction,
} from "@/lib/actions/projects";
import { ROLE_LABELS } from "@/lib/constants";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectMember, UserSummary } from "@/lib/types";

export function MembersSettings({
  projectId,
  members,
  allUsers,
  canManage,
  archived,
}: {
  projectId: string;
  members: ProjectMember[];
  allUsers: Array<UserSummary & { email: string }>;
  canManage: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [role, setRole] = React.useState<"editor" | "viewer">("editor");
  const [adding, setAdding] = React.useState(false);

  const memberIds = new Set(members.map((member) => member.user.id));
  const candidates = allUsers.filter(
    (user) =>
      !memberIds.has(user.id) &&
      (search.trim() === "" ||
        user.displayName.toLowerCase().includes(search.toLowerCase()) ||
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()))
  );

  async function addMember() {
    if (!selectedUserId) return;
    setAdding(true);
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("userId", selectedUserId);
    formData.set("role", role);
    const result = await addMemberAction(null, formData);
    setAdding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("成员已添加");
    setSelectedUserId("");
    setSearch("");
    router.refresh();
  }

  async function changeRole(userId: string, nextRole: "editor" | "viewer") {
    const result = await updateMemberRoleAction(projectId, userId, nextRole);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("角色已更新");
    router.refresh();
  }

  async function removeMember(userId: string) {
    const result = await removeMemberAction(projectId, userId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("成员已移除");
    router.refresh();
  }

  async function transferOwner(userId: string) {
    const result = await transferOwnerAction(projectId, userId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("所有权已转让");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {canManage && !archived ? (
        <Card>
          <CardHeader>
            <CardTitle>添加成员</CardTitle>
            <CardDescription>
              从已注册用户中选择；MVP 不发送邮件邀请。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <div className="space-y-2">
                <Label>搜索用户</Label>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="用户名、显示名或邮箱"
                />
              </div>
              <div className="space-y-2">
                <Label>选择用户</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择用户" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        没有可选用户
                      </SelectItem>
                    ) : (
                      candidates.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.displayName} · @{user.username}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select value={role} onValueChange={(value) => setRole(value as "editor" | "viewer")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">{ROLE_LABELS.editor}</SelectItem>
                    <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void addMember()}
                disabled={!selectedUserId || adding}
              >
                {adding ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                添加成员
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>项目成员</CardTitle>
          <CardDescription>
            查看者只读；编辑者可以维护卡片；所有者可以管理项目设置。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border">
            {members.map((member) => {
              const isOwner = member.role === "owner";
              return (
                <div
                  key={member.user.id}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
                >
                  <UserAvatar
                    id={member.user.id}
                    name={member.user.displayName}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {member.user.displayName}
                      </p>
                      {isOwner ? (
                        <Badge variant="secondary" className="gap-1">
                          <Crown className="size-3" />
                          所有者
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      @{member.user.username}
                      {member.user.email ? ` · ${member.user.email}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <Badge variant="outline">{ROLE_LABELS.owner}</Badge>
                    ) : canManage && !archived ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          void changeRole(
                            member.user.id,
                            value as "editor" | "viewer"
                          )
                        }
                      >
                        <SelectTrigger size="sm" className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">{ROLE_LABELS.editor}</SelectItem>
                          <SelectItem value="viewer">{ROLE_LABELS.viewer}</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{ROLE_LABELS[member.role]}</Badge>
                    )}

                    {canManage && !archived && !isOwner ? (
                      <>
                        <ConfirmAction
                          title="转让项目所有权？"
                          description={`将项目所有权转让给 ${member.user.displayName}。你将变为编辑者。`}
                          confirmLabel="转让"
                          onConfirm={() => transferOwner(member.user.id)}
                        >
                          <Button variant="ghost" size="sm">
                            <Crown className="size-4" />
                            转让 owner
                          </Button>
                        </ConfirmAction>

                        <ConfirmAction
                          title="移除成员？"
                          description={`将 ${member.user.displayName} 移出项目，并清理其卡片负责人关系。`}
                          confirmLabel="移除"
                          destructive
                          onConfirm={() => removeMember(member.user.id)}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="移除成员"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </ConfirmAction>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
