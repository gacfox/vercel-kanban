import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getAppSettings } from "@/lib/db/queries/app-settings";
import { countUsers } from "@/lib/db/queries/users";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetupForm } from "@/components/auth/setup-form";

export const instant = false;

export default async function SetupPage() {
  await connection();
  const initialized = (await countUsers()) > 0;
  if (initialized) redirect("/login");

  const settings = await getAppSettings();

  return (
    <AuthShell
      siteName={settings.siteName}
      title="初始化看板"
      description="这是首次部署，请创建管理员账号。"
      wide
    >
      <SetupForm />
    </AuthShell>
  );
}
