"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  KanbanSquare,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import { ColorDot } from "@/components/shared/color-dot";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { SessionUser } from "@/lib/types";

export type SidebarProject = {
  id: string;
  name: string;
  color: string;
};

export function AppSidebar({
  user,
  projects,
  siteName,
}: {
  user: SessionUser;
  projects: SidebarProject[];
  siteName: string;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={siteName}>
              <Link href="/projects">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <KanbanSquare className="size-4" />
                </span>
                <span className="truncate font-semibold">{siteName}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>看板</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/projects"}
                  tooltip="全部项目"
                >
                  <Link href="/projects">
                    <LayoutDashboard className="size-4" />
                    <span>全部项目</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {projects.map((project) => (
                <SidebarMenuItem key={project.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(`/projects/${project.id}`)}
                    tooltip={project.name}
                  >
                    <Link href={`/projects/${project.id}`}>
                      <ColorDot color={project.color} />
                      <span className="truncate">{project.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user.role === "admin" ? (
          <SidebarGroup>
            <SidebarGroupLabel>管理</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/users")}
                    tooltip="用户管理"
                  >
                    <Link href="/admin/users">
                      <Users className="size-4" />
                      <span>用户管理</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith("/admin/settings")}
                    tooltip="站点设置"
                  >
                    <Link href="/admin/settings">
                      <Settings className="size-4" />
                      <span>站点设置</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={user.displayName}>
              <Link href="/profile">
                <UserAvatar id={user.id} name={user.displayName} size="sm" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {user.displayName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    @{user.username}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
