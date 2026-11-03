import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/db/queries/app-settings";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const instant = false;

export default async function ChangePasswordPage() {
  await connection();
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/projects");

  const settings = await getAppSettings();

  return (
    <AuthShell
      siteName={settings.siteName}
      title="修改密码"
      description="管理员为你设置了临时密码，请先修改密码。"
    >
      <ChangePasswordForm />
    </AuthShell>
  );
}
