import { connection } from "next/server";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAppSettings } from "@/lib/db/queries/app-settings";
import { AdminSettings } from "@/components/admin/admin-settings";

export const instant = false;

export default async function AdminSettingsPage() {
  await connection();
  await requireAdminPage();
  const settings = await getAppSettings();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">站点设置</h1>
        <p className="text-sm text-muted-foreground">
          配置站点名称、注册开关和查看系统状态。
        </p>
      </div>
      <AdminSettings
        siteName={settings.siteName}
        allowRegistration={settings.allowRegistration}
      />
    </div>
  );
}
