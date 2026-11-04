"use client";

import * as React from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Archive,
  Loader2,
  RefreshCw,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoard, BoardProvider } from "@/components/board/board-provider";
import { BoardColumn } from "@/components/board/board-column";
import { BoardFilters } from "@/components/board/board-filters";
import { CardSheet } from "@/components/board/card-sheet";
import { ColumnDialog } from "@/components/board/column-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BoardData, BoardCard } from "@/lib/types";

export function Board({ initialData }: { initialData: BoardData }) {
  return (
    <BoardProvider initialData={initialData}>
      <BoardView />
    </BoardProvider>
  );
}

function BoardView() {
  const {
    data,
    isRefreshing,
    isSaving,
    lastRefreshedAt,
    refresh,
    setIsDragging,
    moveCard,
    canManage,
  } = useBoard();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const activeCard = React.useMemo(
    () => (activeId ? data.cards.find((card) => card.id === activeId) ?? null : null),
    [activeId, data.cards]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setIsDragging(true);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const active = event.active;
    const over = event.over;
    setIsDragging(false);

    if (!over) {
      setActiveId(null);
      return;
    }

    const card = data.cards.find((item) => item.id === String(active.id));
    if (!card) {
      setActiveId(null);
      return;
    }

    const overData = over.data.current as
      | { type?: string; columnId?: string }
      | undefined;
    const targetColumnId =
      overData?.columnId ??
      (data.columns.some((column) => column.id === String(over.id))
        ? String(over.id)
        : null);

    if (!targetColumnId) {
      setActiveId(null);
      return;
    }

    const targetCards = data.cards
      .filter(
        (item) =>
          item.columnId === targetColumnId && item.id !== String(active.id)
      )
      .sort(
        (a, b) =>
          a.position - b.position ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id)
      );

    const overCardId =
      overData?.type === "card" ? String(over.id) : null;
    let beforeCardId: string | null = null;
    let afterCardId: string | null = null;
    let targetIndex: number | undefined;

    if (overCardId) {
      const overIndex = targetCards.findIndex((item) => item.id === overCardId);
      if (overIndex >= 0) {
        if (card.columnId === targetColumnId) {
          const activeIndex = targetCards.findIndex((item) => item.id === card.id);
          if (activeIndex < overIndex) {
            afterCardId = overCardId;
          } else {
            beforeCardId = overCardId;
          }
        } else {
          beforeCardId = overCardId;
        }
      } else {
        targetIndex = targetCards.length;
      }
    } else {
      targetIndex = targetCards.length;
    }

    setActiveId(null);
    await moveCard(
      card.id,
      targetColumnId,
      beforeCardId,
      afterCardId,
      targetIndex
    );
  }

  return (
    <DndContext
      id="kanban-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => {
        setActiveId(null);
        setIsDragging(false);
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {data.project.archivedAt ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Archive className="size-4" />
            该项目已归档，当前为只读状态。
            {canManage ? (
              <Button asChild variant="link" size="sm" className="ml-auto h-auto p-0">
                <Link href={`/projects/${data.project.id}/settings`}>恢复项目</Link>
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {data.project.name}
                </h1>
                {data.project.archivedAt ? (
                  <Badge variant="outline">已归档</Badge>
                ) : null}
              </div>
              {data.project.description ? (
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {data.project.description}
                </p>
              ) : null}
              <div
                className="flex items-center gap-2 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {data.members.length} 位成员
                </span>
                <span>·</span>
                {isSaving ? (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="size-3.5 animate-spin" />
                    保存中…
                  </span>
                ) : (
                  <span>
                    上次刷新{" "}
                    {lastRefreshedAt
                      ? lastRefreshedAt.toLocaleTimeString("zh-CN")
                      : "刚刚"}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex -space-x-2">
                {data.members.slice(0, 5).map((member) => (
                  <UserAvatar
                    key={member.user.id}
                    id={member.user.id}
                    name={member.user.displayName}
                    size="sm"
                    className="ring-2 ring-background"
                  />
                ))}
                {data.members.length > 5 ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-background">
                    +{data.members.length - 5}
                  </span>
                ) : null}
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={isRefreshing || isSaving}
                  >
                    {isRefreshing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    刷新
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  手动获取其他人的最新修改（不做自动轮询）
                </TooltipContent>
              </Tooltip>

              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${data.project.id}/archive`}>
                  <Archive className="size-4" />
                  归档
                </Link>
              </Button>

              {canManage ? (
                <>
                  {!data.project.archivedAt ? (
                    <ColumnDialog projectId={data.project.id} />
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/projects/${data.project.id}/settings`}>
                      <Settings className="size-4" />
                      设置
                    </Link>
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <BoardFilters />
        </div>

        {data.columns.length === 0 ? (
          <Empty className="flex-1 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Archive />
              </EmptyMedia>
              <EmptyTitle>还没有看板列</EmptyTitle>
              <EmptyDescription>
                先添加一列，例如“待办”，然后开始创建卡片。
              </EmptyDescription>
            </EmptyHeader>
            {canManage && !data.project.archivedAt ? (
              <EmptyContent>
                <ColumnDialog projectId={data.project.id} />
              </EmptyContent>
            ) : null}
          </Empty>
        ) : (
          <div
            className={cn(
              "flex min-h-0 flex-1 items-start gap-4 overflow-x-auto pb-4",
              data.project.archivedAt && "opacity-90"
            )}
          >
            {data.columns.map((column) => (
              <BoardColumn key={column.id} column={column} />
            ))}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeCard ? <DragPreview card={activeCard} /> : null}
      </DragOverlay>

      <CardSheet />
    </DndContext>
  );
}

function DragPreview({ card }: { card: BoardCard }) {
  return (
    <div className="w-72 rotate-1 rounded-lg border bg-card p-3 shadow-lg">
      {card.labels.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="inline-flex h-4 items-center rounded bg-muted px-1.5 text-[10px] text-muted-foreground"
            >
              {label.name}
            </span>
          ))}
        </div>
      ) : null}
      <p className="line-clamp-3 text-sm font-medium">{card.title}</p>
    </div>
  );
}

export type { BoardData };
