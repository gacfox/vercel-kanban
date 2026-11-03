"use client";

import { AlertCircle } from "lucide-react";
import { useActionState } from "react";
import { changePasswordAction, type AuthFormState } from "@/lib/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    changePasswordAction,
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
        <Label htmlFor="currentPassword">当前密码</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
        {state?.fieldErrors?.currentPassword?.[0] ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.currentPassword[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">新密码</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
        {state?.fieldErrors?.newPassword?.[0] ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.newPassword[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认新密码</Label>
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

      <SubmitButton className="w-full" pendingText="保存中...">
        修改密码
      </SubmitButton>
    </form>
  );
}
