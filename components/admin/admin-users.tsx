"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  KeyRound,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { useActionState } from "react";
import {
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
  updateUserRoleAction,
  updateUserStatusAction,
} from "@/lib/actions/admin";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { LocalDate } from "@/components/shared/local-date";
import { SubmitButton } from "@/components/shared/submit-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActionResult, AdminUser } from "@/lib/types";

export function AdminUsers({
  users,
  currentUserId,
}: {
  users: AdminUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createState, createAction] = useActionState<
    ActionResult<{ userId: string }> | null,
    FormData
  >(async (prevState, formData) => {
    const result = await createUserAction(prevState, formData);
    if (result.ok) {
      React.startTransition(() => setCreateOpen(false));
      toast.success("用户已创建");
      router.refresh();
    }
    return result;
  }, null);

  const filtered = users.filter((user) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      user.username.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.displayName.toLowerCase().includes(term)
    );
  });

  async function changeRole(userId: string, role: "admin" | "user") {
    const result = await updateUserRoleAction(userId, role);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("角色已更新");
    router.refresh();
  }

  async function toggleStatus(user: AdminUser) {
    const next = user.status === "active" ? "disabled" : "active";
    const result = await updateUserStatusAction(user.id, next);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(next === "active" ? "用户已启用" : "用户已禁用");
    router.refresh();
  }

  async function remove(userId: string) {
    const result = await deleteUserAction(userId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("用户已删除");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索用户名、邮箱、显示名"
            className="pl-8"
          />
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              新建用户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form action={createAction} className="space-y-4">
              <DialogHeader>
                <DialogTitle>新建用户</DialogTitle>
                <DialogDescription>
                  创建后用户首次登录需要修改密码。
                </DialogDescription>
              </DialogHeader>

              {createState && !createState.ok ? (
                <p className="text-sm text-destructive">{createState.error}</p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-username">用户名</Label>
                  <Input id="new-username" name="username" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-display-name">显示名</Label>
                  <Input id="new-display-name" name="displayName" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-email">邮箱</Label>
                <Input id="new-email" name="email" type="email" required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">初始密码</Label>
                  <Input
                    id="new-password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>全局角色</Label>
                  <Select name="role" defaultValue="user">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">普通用户</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  取消
                </Button>
                <SubmitButton pendingText="创建中...">创建用户</SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最后登录</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        id={user.id}
                        name={user.displayName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {user.displayName}
                          </span>
                          {isSelf ? (
                            <Badge variant="outline" className="text-[10px]">
                              我
                            </Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          @{user.username} · {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        void changeRole(user.id, value as "admin" | "user")
                      }
                    >
                      <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <span className="flex items-center gap-1">
                            <UserCog className="size-3.5" />
                            普通用户
                          </span>
                        </SelectItem>
                        <SelectItem value="admin">
                          <span className="flex items-center gap-1">
                            <Shield className="size-3.5" />
                            管理员
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.status === "active" ? "secondary" : "outline"}
                      className="gap-1"
                    >
                      {user.status === "active" ? (
                        <CheckCircle2 className="size-3" />
                      ) : (
                        <Ban className="size-3" />
                      )}
                      {user.status === "active" ? "正常" : "已禁用"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.lastLoginAt ? (
                      <LocalDate value={user.lastLoginAt} relative />
                    ) : (
                      "从未登录"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <ResetPasswordDialog
                        userId={user.id}
                        displayName={user.displayName}
                        onDone={() => router.refresh()}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => void toggleStatus(user)}
                        aria-label={user.status === "active" ? "禁用用户" : "启用用户"}
                        disabled={isSelf}
                      >
                        {user.status === "active" ? (
                          <Ban className="size-4" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                      </Button>
                      <ConfirmAction
                        title="删除用户？"
                        description={`删除 ${user.displayName} 会移除其项目成员关系、卡片负责人和会话。若其拥有项目，需要先转让。`}
                        confirmLabel="删除"
                        destructive
                        onConfirm={() => remove(user.id)}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="删除用户"
                          disabled={isSelf}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </ConfirmAction>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">没有匹配的用户。</p>
      ) : null}
    </div>
  );
}

function ResetPasswordDialog({
  userId,
  displayName,
  onDone,
}: {
  userId: string;
  displayName: string;
  onDone: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function reset() {
    setPending(true);
    const result = await resetUserPasswordAction(userId, password);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("密码已重置，该用户需要重新登录并改密");
    setPassword("");
    setOpen(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="重置密码">
          <KeyRound className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>重置 {displayName} 的密码</DialogTitle>
          <DialogDescription>
            重置后该用户的所有会话会失效，并在下次登录时强制改密。
          </DialogDescription>
        </DialogHeader>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="新密码（至少 8 位）"
          autoComplete="new-password"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={pending || password.length < 8}
            onClick={() => void reset()}
          >
            重置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
