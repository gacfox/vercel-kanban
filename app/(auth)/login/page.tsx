import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/db/queries/app-settings";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await connection();
  const user = await getSessionUser();
  if (user) redirect("/projects");

  const [{ from }, settings] = await Promise.all([
    searchParams,
    getAppSettings(),
  ]);

  return (
    <AuthShell
      siteName={settings.siteName}
      title="登录"
      description="使用用户名或邮箱登录你的看板"
    >
      <LoginForm from={from} allowRegistration={settings.allowRegistration} />
    </AuthShell>
  );
}
