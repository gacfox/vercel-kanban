import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { requireProjectAccessPage } from "@/lib/auth/guards";
import {
  getArchivedCards,
  getProjectSettingsData,
} from "@/lib/db/queries/board";
import { ArchiveView } from "@/components/projects/archive-view";
import { Button } from "@/components/ui/button";

export const instant = false;

export default async function ProjectArchivePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await connection();

  const { user, role, isAdmin, project } = await requireProjectAccessPage(
    projectId,
    "viewer"
  );
  const [cards, settings] = await Promise.all([
    getArchivedCards(projectId),
    getProjectSettingsData(projectId, role, isAdmin),
  ]);
  const canEdit =
    !project.archived_at && (role === "editor" || role === "owner" || isAdmin);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="size-4" />
            返回看板
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">归档卡片</h1>
          <p className="text-sm text-muted-foreground">
            恢复卡片会回到原列；原列不存在时回到第一列。
          </p>
        </div>
      </div>

      <ArchiveView
        projectId={projectId}
        cards={cards}
        canEdit={canEdit}
        boardData={{
          project: settings.project,
          columns: settings.columns,
          cards: [],
          labels: settings.labels,
          fields: settings.fields,
          members: settings.members,
          role,
          isAdmin,
          canEdit: false,
          canManage: false,
          snapshotRevision: "",
          currentUser: user,
        }}
      />
    </div>
  );
}
