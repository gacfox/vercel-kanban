import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/db/queries/app-settings";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { Button } from "@/components/ui/button";

export const instant = false;

export default async function RegisterPage() {
  await connection();
  const user = await getSessionUser();
  if (user) redirect("/projects");

  const settings = await getAppSettings();

  return (
    <AuthShell
      siteName={settings.siteName}
      title="注册"
      description={
        settings.allowRegistration
          ? "创建一个新账号，立即开始使用"
          : "当前站点未开放注册"
      }
      wide
    >
      {settings.allowRegistration ? (
        <RegisterForm />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            管理员已关闭注册。请联系管理员创建账号，或使用已有账号登录。
          </p>
          <Button asChild className="w-full">
            <Link href="/login">返回登录</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
