"use client";

import * as React from "react";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { CalendarClock, GripVertical, MessageSquare } from "lucide-react";
import { LABEL_COLOR_MAP } from "@/lib/constants";
import { formatFieldValue } from "@/lib/field-format";
import { cn } from "@/lib/utils";
import { useBoard } from "@/components/board/board-provider";
import { PriorityIcon } from "@/components/board/priority-icon";
import { LocalDate } from "@/components/shared/local-date";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { BoardCard as BoardCardType } from "@/lib/types";

export function BoardCard({
  card,
  columnId,
  canEdit,
  isHistory = false,
}: {
  card: BoardCardType;
  columnId: string;
  canEdit: boolean;
  isHistory?: boolean;
}) {
  const { openCard, data } = useBoard();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", columnId },
    disabled: !canEdit || isHistory,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const visibleFields = data.fields
    .filter((field) => field.showOnCard)
    .map((field) => ({
      field,
      value: formatFieldValue(
        field,
        card.fieldValues[field.id],
        data.members.map((member) => member.user)
      ),
    }))
    .filter((item) => item.value)
    .slice(0, 3);

  const overdue = card.dueAt ? new Date(card.dueAt) < new Date() : false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/card rounded-lg border bg-card p-3 shadow-xs transition-colors",
        canEdit && !isHistory && "hover:border-foreground/20",
        isDragging && "opacity-40",
        isHistory && "bg-muted/30"
      )}
    >
      <div className="flex items-start gap-2">
        {canEdit && !isHistory ? (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground/60 opacity-100 transition-opacity hover:text-foreground sm:opacity-0 sm:group-hover/card:opacity-100 focus-visible:opacity-100"
            aria-label="拖动卡片"
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : null}

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => openCard(card.id)}
        >
          {card.labels.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1">
              {card.labels.slice(0, 3).map((label) => {
                const color = LABEL_COLOR_MAP[label.color] ?? LABEL_COLOR_MAP.slate;
                return (
                  <span
                    key={label.id}
                    className={cn(
                      "inline-flex h-4 items-center rounded px-1.5 text-[10px] font-medium",
                      color.className
                    )}
                  >
                    {label.name}
                  </span>
                );
              })}
              {card.labels.length > 3 ? (
                <span className="text-[10px] text-muted-foreground">
                  +{card.labels.length - 3}
                </span>
              ) : null}
            </div>
          ) : null}

          <p className="line-clamp-3 text-sm font-medium break-words">{card.title}</p>

          {card.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {card.description.replace(/[#*_>`-]/g, "").slice(0, 120)}
            </p>
          ) : null}

          {visibleFields.length > 0 ? (
            <div className="mt-2 space-y-0.5">
              {visibleFields.map(({ field, value }) => (
                <p key={field.id} className="truncate text-[11px] text-muted-foreground">
                  <span className="text-muted-foreground/70">{field.name}:</span>{" "}
                  {value}
                </p>
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <PriorityIcon priority={card.priority} className="size-3.5" />
            {card.dueAt ? (
              <span
                className={cn(
                  "flex items-center gap-1",
                  overdue && "text-red-600 dark:text-red-400"
                )}
              >
                <CalendarClock className="size-3.5" />
                <LocalDate value={card.dueAt} mode="date" />
              </span>
            ) : null}
            {card.commentCount > 0 ? (
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3.5" />
                {card.commentCount}
              </span>
            ) : null}
          </div>
        </button>

        {card.assignees.length > 0 ? (
          <div className="flex -space-x-1.5">
            {card.assignees.slice(0, 3).map((assignee) => (
              <UserAvatar
                key={assignee.id}
                id={assignee.id}
                name={assignee.displayName}
                size="sm"
                className="size-5 ring-2 ring-card"
              />
            ))}
            {card.assignees.length > 3 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground ring-2 ring-card">
                +{card.assignees.length - 3}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
