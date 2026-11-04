"use client";

import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useActionState } from "react";
import { updateProfileAction, type AuthFormState } from "@/lib/actions/auth";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionUser } from "@/lib/types";

export function ProfileSettings({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [, formAction] = useActionState<AuthFormState, FormData>(
    async (prevState, formData) => {
      const result = await updateProfileAction(prevState, formData);
      if (result?.success) {
        toast.success("资料已保存");
        router.refresh();
      }
      return result;
    },
    null
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>用户名和邮箱由管理员维护。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input value={user.username} disabled />
              </div>
              <div className="space-y-2">
                <Label>邮箱</Label>
                <Input value={user.email} disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-display-name">显示名</Label>
              <Input
                id="profile-display-name"
                name="displayName"
                defaultValue={user.displayName}
                required
              />
            </div>
            <div className="flex justify-end">
              <SubmitButton>
                <Save className="size-4" />
                保存资料
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>
            修改成功后会保留当前会话，并退出其他设备。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
