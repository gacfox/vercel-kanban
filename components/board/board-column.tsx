"use client";

import * as React from "react";
import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  CalendarRange,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { loadColumnHistoryAction } from "@/lib/actions/board";
import { cn } from "@/lib/utils";
import { useBoard, matchesFilters } from "@/components/board/board-provider";
import { BoardCard } from "@/components/board/board-card";
import { CardComposer } from "@/components/board/card-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardCard as BoardCardType, BoardColumn as BoardColumnType } from "@/lib/types";

export function BoardColumn({ column }: { column: BoardColumnType }) {
  const { data, filters, canEdit, canManage } = useBoard();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const [historyCards, setHistoryCards] = React.useState<BoardCardType[]>([]);
  const [historyHasMore, setHistoryHasMore] = React.useState(
    column.hiddenCount > 0
  );
  const [historyLoading, setHistoryLoading] = React.useState(false);

  React.useEffect(() => {
    setHistoryCards([]);
    setHistoryHasMore(column.hiddenCount > 0);
  }, [column.hiddenCount, column.historyWindowDays, column.id]);

  const cards = data.cards
    .filter((card) => card.columnId === column.id)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id)
    );
  const visibleCards = cards.filter((card) => matchesFilters(card, filters));
  const visibleHistory = historyCards.filter((card) =>
    matchesFilters(card, filters)
  );
  const loadedHistoryIds = new Set(historyCards.map((card) => card.id));
  const hiddenRemaining = Math.max(
    0,
    column.hiddenCount - historyCards.length
  );
  const displayedCards = [
    ...visibleCards,
    ...visibleHistory.filter((card) => !visibleCards.some((item) => item.id === card.id)),
  ];
  const totalCount = cards.length + historyCards.length + hiddenRemaining;

  const wipExceeded =
    column.wipLimit != null && totalCount > column.wipLimit;

  async function loadMoreHistory() {
    if (historyLoading) return;
    setHistoryLoading(true);
    const result = await loadColumnHistoryAction({
      projectId: data.project.id,
      columnId: column.id,
      offset: historyCards.length,
    });
    setHistoryLoading(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (result.data) {
      const incoming = result.data.cards.filter(
        (card) => !loadedHistoryIds.has(card.id)
      );
      setHistoryCards((prev) => [...prev, ...incoming]);
      setHistoryHasMore(result.data.hasMore);
    }
  }

  return (
    <section
      className={cn(
        "flex w-[300px] shrink-0 flex-col rounded-xl border bg-muted/40 sm:w-[320px]",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b p-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{column.title}</h3>
            {column.isDone ? (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                完成
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>
              {displayedCards.length} / {totalCount}
            </span>
            {column.wipLimit != null ? (
              <span
                className={cn(
                  "rounded px-1 py-0.5",
                  wipExceeded
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-muted"
                )}
              >
                WIP {totalCount}/{column.wipLimit}
              </span>
            ) : null}
            {column.historyWindowDays != null ? (
              <span className="flex items-center gap-1 rounded bg-muted px-1 py-0.5">
                <CalendarRange className="size-3" />
                最近 {column.historyWindowDays} 天
              </span>
            ) : null}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              aria-label="列菜单"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManage ? (
              <DropdownMenuItem asChild>
                <Link href={`/projects/${data.project.id}/settings?tab=columns`}>
                  <Settings2 className="size-4" />
                  管理列
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>没有管理权限</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div
        ref={setNodeRef}
        className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2"
      >
        <SortableContext
          items={visibleCards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleCards.map((card) => (
            <BoardCard key={card.id} card={card} columnId={column.id} canEdit={canEdit} />
          ))}
        </SortableContext>

        {visibleHistory.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              历史卡片
              <span className="h-px flex-1 bg-border" />
            </div>
            {visibleHistory.map((card) => (
              <BoardCard
                key={card.id}
                card={card}
                columnId={column.id}
                canEdit={false}
                isHistory
              />
            ))}
          </div>
        ) : null}

        {displayedCards.length === 0 && !historyHasMore ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            暂无卡片
          </div>
        ) : null}

        {historyHasMore || hiddenRemaining > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs text-muted-foreground"
            onClick={() => void loadMoreHistory()}
            disabled={historyLoading}
          >
            {historyLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
            {historyLoading
              ? "加载中..."
              : hiddenRemaining > 0
                ? `显示历史（还有 ${hiddenRemaining} 张）`
                : "加载更多"}
          </Button>
        ) : null}
      </div>

      <div className="border-t p-2">
        {canEdit ? (
          <CardComposer columnId={column.id} />
        ) : (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">只读</p>
        )}
      </div>
    </section>
  );
}
