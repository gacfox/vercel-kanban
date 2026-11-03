"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useActionState } from "react";
import { updateSiteSettingsAction } from "@/lib/actions/admin";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SubmitButton } from "@/components/shared/submit-button";
import type { ActionResult } from "@/lib/types";

export function AdminSettings({
  siteName,
  allowRegistration,
}: {
  siteName: string;
  allowRegistration: boolean;
}) {
  const router = useRouter();
  const [registration, setRegistration] = React.useState(allowRegistration);
  const [health, setHealth] = React.useState<"loading" | "ok" | "error">("loading");
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateSiteSettingsAction,
    null
  );

  React.useEffect(() => {
    setRegistration(allowRegistration);
  }, [allowRegistration]);

  React.useEffect(() => {
    if (state?.ok) {
      toast.success("站点设置已保存");
      router.refresh();
    }
  }, [state, router]);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((response) => {
        if (!cancelled) setHealth(response.ok ? "ok" : "error");
      })
      .catch(() => {
        if (!cancelled) setHealth("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>站点设置</CardTitle>
          <CardDescription>站点名称和注册开关。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state && !state.ok ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="site-name">站点名称</Label>
              <Input id="site-name" name="siteName" defaultValue={siteName} required />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="allow-registration">允许注册</Label>
                <p className="text-xs text-muted-foreground">
                  关闭后，只有管理员可以创建账号。首次部署默认关闭。
                </p>
              </div>
              <input
                type="hidden"
                name="allowRegistration"
                value={registration ? "true" : "false"}
              />
              <Switch
                id="allow-registration"
                checked={registration}
                onCheckedChange={setRegistration}
              />
            </div>

            <div className="flex justify-end">
              <SubmitButton>
                <Save className="size-4" />
                保存设置
              </SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>系统信息</CardTitle>
          <CardDescription>运行状态与定时任务说明。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">数据库连通性</span>
            <span className="flex items-center gap-1">
              {health === "loading" ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  检查中
                </>
              ) : health === "ok" ? (
                <>
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  正常
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-destructive" />
                  异常
                </>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">自动化 Cron</span>
            <span>每天 00:00 UTC（北京时间 08:00）</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Vercel Hobby 每天最多执行一次；事件类自动化仍然是即时执行。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
