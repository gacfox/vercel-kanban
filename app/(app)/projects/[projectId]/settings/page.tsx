import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { requireProjectAccessPage } from "@/lib/auth/guards";
import { getProjectSettingsData } from "@/lib/db/queries/board";
import { getAllUserSummaries } from "@/lib/db/queries/users";
import {
  getAutomationRuns,
  getAutomations,
} from "@/lib/db/queries/automations";
import { ProjectSettings } from "@/components/projects/project-settings";
import { Button } from "@/components/ui/button";

export const instant = false;

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;
  await connection();

  const { role, isAdmin } = await requireProjectAccessPage(projectId, "owner");
  const [data, allUsers, automations, runs] = await Promise.all([
    getProjectSettingsData(projectId, role, isAdmin),
    getAllUserSummaries(),
    getAutomations(projectId),
    getAutomationRuns(projectId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="size-4" />
            返回看板
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {data.project.name} · 设置
          </h1>
          <p className="text-sm text-muted-foreground">
            管理项目信息、成员、列、字段、标签和自动化。
          </p>
        </div>
      </div>

      <ProjectSettings
        data={data}
        allUsers={allUsers}
        automations={automations}
        runs={runs}
        defaultTab={tab}
      />
    </div>
  );
}
