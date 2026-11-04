"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { archiveCardAction, deleteCardAction } from "@/lib/actions/board";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { LocalDate } from "@/components/shared/local-date";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ArchivedCard } from "@/lib/types";

export function ArchivedCards({
  projectId,
  cards,
  canEdit,
  onOpenCard,
}: {
  projectId: string;
  cards: ArchivedCard[];
  canEdit: boolean;
  onOpenCard: (cardId: string) => void;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function restore(cardId: string) {
    setPendingId(cardId);
    const result = await archiveCardAction({ projectId, cardId, archived: false });
    setPendingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("卡片已恢复");
    router.refresh();
  }

  async function remove(cardId: string) {
    const result = await deleteCardAction({ projectId, cardId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("卡片已彻底删除");
    router.refresh();
  }

  if (cards.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ArchiveRestore />
          </EmptyMedia>
          <EmptyTitle>暂无归档卡片</EmptyTitle>
          <EmptyDescription>
            卡片归档后会出现在这里，可以恢复或彻底删除。
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="divide-y rounded-xl border bg-card">
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpenCard(card.id)}
          >
            <span className="block truncate text-sm font-medium hover:underline">
              {card.title}
            </span>
            <span className="block text-xs text-muted-foreground">
              原列：{card.columnTitle ?? "已删除的列"} · 归档于{" "}
              <LocalDate value={card.archivedAt} />
            </span>
            {card.labels.length > 0 ? (
              <span className="mt-1 flex flex-wrap gap-1">
                {card.labels.map((label) => (
                  <span
                    key={label.id}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {label.name}
                  </span>
                ))}
              </span>
            ) : null}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {card.assignees.map((assignee) => (
                <UserAvatar
                  key={assignee.id}
                  id={assignee.id}
                  name={assignee.displayName}
                  size="sm"
                />
              ))}
            </div>

            {canEdit ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pendingId === card.id}
                  onClick={() => void restore(card.id)}
                >
                  {pendingId === card.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArchiveRestore className="size-4" />
                  )}
                  恢复
                </Button>
                <ConfirmAction
                  title="彻底删除卡片？"
                  description="删除后无法恢复，评论、字段值和活动记录也会被删除。"
                  confirmLabel="删除"
                  destructive
                  onConfirm={() => remove(card.id)}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="彻底删除卡片"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </ConfirmAction>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
