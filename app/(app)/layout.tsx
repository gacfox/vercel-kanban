import { connection } from "next/server";
import { requireUserPage } from "@/lib/auth/guards";
import { getAppSettings } from "@/lib/db/queries/app-settings";
import { getSidebarProjects } from "@/lib/db/queries/projects";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const instant = false;

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await connection();
  const user = await requireUserPage();
  const [settings, projects] = await Promise.all([
    getAppSettings(),
    getSidebarProjects(user),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar user={user} projects={projects} siteName={settings.siteName} />
      <SidebarInset>
        <AppHeader user={user} />
        <main className="flex flex-1 flex-col p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
