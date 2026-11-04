"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/lib/actions/auth";
import { useNavigationProgress } from "@/components/layout/navigation-progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/shared/submit-button";

export function LoginForm({
  from,
  allowRegistration,
}: {
  from?: string;
  allowRegistration: boolean;
}) {
  const { start, finish } = useNavigationProgress();
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    async (prevState, formData) => {
      start();
      const result = await loginAction(prevState, formData);
      if (result) finish();
      return result;
    },
    null
  );
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <input type="hidden" name="from" value={from ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="login">用户名或邮箱</Label>
        <Input
          id="login"
          name="login"
          autoComplete="username"
          autoFocus
          required
          aria-invalid={Boolean(state?.fieldErrors?.login)}
        />
        {state?.fieldErrors?.login?.[0] ? (
          <p className="text-xs text-destructive">{state.fieldErrors.login[0]}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="pr-10"
            aria-invalid={Boolean(state?.fieldErrors?.password)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 h-full w-9 hover:bg-transparent"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </div>
        {state?.fieldErrors?.password?.[0] ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      <SubmitButton className="w-full" pendingText="登录中...">
        登录
      </SubmitButton>

      <p className="text-center text-xs text-muted-foreground">
        忘记密码？请联系管理员重置。
      </p>

      {allowRegistration ? (
        <p className="text-center text-sm text-muted-foreground">
          没有账号？{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            注册
          </Link>
        </p>
      ) : null}
    </form>
  );
}
