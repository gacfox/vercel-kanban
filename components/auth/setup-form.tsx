"use client";

import { AlertCircle } from "lucide-react";
import { useActionState } from "react";
import { setupAction, type AuthFormState } from "@/lib/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

export function SetupForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    setupAction,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="siteName">站点名称</Label>
        <Input id="siteName" name="siteName" defaultValue="Kanban" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="username">管理员用户名</Label>
          <Input id="username" name="username" autoComplete="username" required />
          {state?.fieldErrors?.username?.[0] ? (
            <p className="text-xs text-destructive">
              {state.fieldErrors.username[0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">显示名</Label>
          <Input id="displayName" name="displayName" required />
          {state?.fieldErrors?.displayName?.[0] ? (
            <p className="text-xs text-destructive">
              {state.fieldErrors.displayName[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">管理员邮箱</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        {state?.fieldErrors?.email?.[0] ? (
          <p className="text-xs text-destructive">{state.fieldErrors.email[0]}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          {state?.fieldErrors?.password?.[0] ? (
            <p className="text-xs text-destructive">
              {state.fieldErrors.password[0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          {state?.fieldErrors?.confirmPassword?.[0] ? (
            <p className="text-xs text-destructive">
              {state.fieldErrors.confirmPassword[0]}
            </p>
          ) : null}
        </div>
      </div>

      <SubmitButton className="w-full" pendingText="创建中...">
        创建管理员并进入
      </SubmitButton>
    </form>
  );
}
