"use client";

import { BoardProvider, useBoard } from "@/components/board/board-provider";
import { CardSheet } from "@/components/board/card-sheet";
import { ArchivedCards } from "@/components/projects/archived-cards";
import type { ArchivedCard, BoardData } from "@/lib/types";

export function ArchiveView({
  projectId,
  cards,
  canEdit,
  boardData,
}: {
  projectId: string;
  cards: ArchivedCard[];
  canEdit: boolean;
  boardData: BoardData;
}) {
  return (
    <BoardProvider initialData={boardData}>
      <ArchiveContent projectId={projectId} cards={cards} canEdit={canEdit} />
    </BoardProvider>
  );
}

function ArchiveContent({
  projectId,
  cards,
  canEdit,
}: {
  projectId: string;
  cards: ArchivedCard[];
  canEdit: boolean;
}) {
  const { openCard } = useBoard();

  return (
    <>
      <ArchivedCards
        projectId={projectId}
        cards={cards}
        canEdit={canEdit}
        onOpenCard={openCard}
      />
      <CardSheet />
    </>
  );
}
