import { connection } from "next/server";
import { requireProjectAccessPage } from "@/lib/auth/guards";
import { getBoardData } from "@/lib/db/queries/board";
import { Board } from "@/components/board/board";

export const instant = false;

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  await connection();

  const { user, role, isAdmin } = await requireProjectAccessPage(
    projectId,
    "viewer"
  );
  const board = await getBoardData(projectId, user, role, isAdmin);

  return <Board initialData={board} />;
}
