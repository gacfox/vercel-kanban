"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  archiveCardAction,
  createCardAction,
  moveCardAction,
  updateCardAction,
} from "@/lib/actions/board";
import type { BoardCard, BoardData, Priority } from "@/lib/types";

export type DueFilter = "all" | "overdue" | "today" | "week" | "none";

export type BoardFilters = {
  search: string;
  assigneeIds: string[];
  labelIds: string[];
  priorities: Priority[];
  due: DueFilter;
};

export const EMPTY_FILTERS: BoardFilters = {
  search: "",
  assigneeIds: [],
  labelIds: [],
  priorities: [],
  due: "all",
};

export type CardPatch = {
  title?: string;
  description?: string;
  priority?: Priority;
  dueAt?: string | null;
  labelIds?: string[];
  assigneeIds?: string[];
  fieldValues?: Record<string, unknown>;
};

type BoardContextValue = {
  data: BoardData;
  projectId: string;
  canEdit: boolean;
  canManage: boolean;
  selectedCardId: string | null;
  openCard: (cardId: string) => void;
  closeCard: () => void;
  filters: BoardFilters;
  setFilters: React.Dispatch<React.SetStateAction<BoardFilters>>;
  resetFilters: () => void;
  isDragging: boolean;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  isRefreshing: boolean;
  isSaving: boolean;
  lastRefreshedAt: Date | null;
  refresh: () => void;
  createCard: (columnId: string, title: string) => Promise<boolean>;
  updateCard: (cardId: string, patch: CardPatch) => Promise<boolean>;
  moveCard: (
    cardId: string,
    targetColumnId: string,
    beforeCardId?: string | null,
    afterCardId?: string | null,
    targetIndex?: number
  ) => Promise<boolean>;
  archiveCard: (cardId: string) => Promise<boolean>;
};

const BoardContext = React.createContext<BoardContextValue | null>(null);

export function useBoard() {
  const context = React.useContext(BoardContext);
  if (!context) throw new Error("useBoard must be used within BoardProvider");
  return context;
}

export function matchesFilters(
  card: BoardCard,
  filters: BoardFilters,
  now = new Date()
): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search) {
    const haystack = [
      card.title,
      card.description,
      ...card.labels.map((label) => label.name),
      ...card.assignees.map((assignee) => assignee.displayName),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  if (
    filters.assigneeIds.length > 0 &&
    !card.assignees.some((assignee) => filters.assigneeIds.includes(assignee.id))
  ) {
    return false;
  }

  if (
    filters.labelIds.length > 0 &&
    !card.labels.some((label) => filters.labelIds.includes(label.id))
  ) {
    return false;
  }

  if (filters.priorities.length > 0 && !filters.priorities.includes(card.priority)) {
    return false;
  }

  if (filters.due !== "all") {
    if (filters.due === "none") {
      if (card.dueAt) return false;
    } else if (!card.dueAt) {
      return false;
    } else {
      const due = new Date(card.dueAt);
      if (filters.due === "overdue" && !(due < now)) return false;
      if (filters.due === "today" && due.toDateString() !== now.toDateString()) {
        return false;
      }
      if (filters.due === "week") {
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (!(due >= now && due <= weekEnd)) return false;
      }
    }
  }

  return true;
}

function applyLocalMove(
  cards: BoardCard[],
  cardId: string,
  targetColumnId: string,
  beforeCardId?: string | null,
  afterCardId?: string | null,
  targetIndex?: number
): BoardCard[] {
  const card = cards.find((item) => item.id === cardId);
  if (!card) return cards;

  const without = cards.filter((item) => item.id !== cardId);
  const target = without
    .filter((item) => item.columnId === targetColumnId)
    .sort(
      (a, b) =>
        a.position - b.position ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id)
    );

  let index = target.length;
  if (beforeCardId) {
    const beforeIndex = target.findIndex((item) => item.id === beforeCardId);
    if (beforeIndex >= 0) index = beforeIndex;
  } else if (afterCardId) {
    const afterIndex = target.findIndex((item) => item.id === afterCardId);
    if (afterIndex >= 0) index = afterIndex + 1;
  } else if (targetIndex !== undefined) {
    index = targetIndex;
  }

  target.splice(Math.max(0, Math.min(index, target.length)), 0, {
    ...card,
    columnId: targetColumnId,
  });

  const positions = new Map(
    target.map((item, idx) => [item.id, (idx + 1) * 1000])
  );

  return cards.map((item) => {
    if (item.id === cardId) {
      return {
        ...item,
        columnId: targetColumnId,
        position: positions.get(cardId) ?? item.position,
        columnEnteredAt:
          item.columnId === targetColumnId
            ? item.columnEnteredAt
            : new Date().toISOString(),
      };
    }
    if (item.columnId === targetColumnId && positions.has(item.id)) {
      return { ...item, position: positions.get(item.id) ?? item.position };
    }
    return item;
  });
}

export function BoardProvider({
  initialData,
  children,
}: {
  initialData: BoardData;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [data, setData] = React.useState(initialData);
  const [selectedCardId, setSelectedCardId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<BoardFilters>(EMPTY_FILTERS);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isRefreshing, startRefresh] = React.useTransition();
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date | null>(null);
  const [pendingSaves, setPendingSaves] = React.useState(0);
  const moveQueue = React.useRef<Promise<void>>(Promise.resolve());

  const beginSave = React.useCallback(() => {
    setPendingSaves((count) => count + 1);
  }, []);

  const endSave = React.useCallback(() => {
    setPendingSaves((count) => Math.max(0, count - 1));
  }, []);

  React.useEffect(() => {
    if (pendingSaves === 0) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [pendingSaves]);

  const lastRevision = React.useRef(initialData.snapshotRevision);
  const pendingSnapshot = React.useRef<BoardData | null>(null);

  React.useEffect(() => {
    if (initialData.snapshotRevision === lastRevision.current) return;

    if (isDragging || selectedCardId) {
      pendingSnapshot.current = initialData;
      return;
    }

    lastRevision.current = initialData.snapshotRevision;
    setData(initialData);
    setLastRefreshedAt(new Date());
  }, [initialData, isDragging, selectedCardId]);

  React.useEffect(() => {
    if (isDragging || selectedCardId) return;
    if (!pendingSnapshot.current) return;
    if (pendingSnapshot.current.snapshotRevision === lastRevision.current) {
      pendingSnapshot.current = null;
      return;
    }
    lastRevision.current = pendingSnapshot.current.snapshotRevision;
    setData(pendingSnapshot.current);
    pendingSnapshot.current = null;
    setLastRefreshedAt(new Date());
  }, [isDragging, selectedCardId]);

  const refresh = React.useCallback(() => {
    startRefresh(() => {
      router.refresh();
    });
    setLastRefreshedAt(new Date());
  }, [router]);

  const openCard = React.useCallback((cardId: string) => {
    setSelectedCardId(cardId);
  }, []);

  const closeCard = React.useCallback(() => {
    setSelectedCardId(null);
  }, []);

  const resetFilters = React.useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const createCard = React.useCallback(
    async (columnId: string, title: string) => {
      beginSave();
      try {
        const formData = new FormData();
        formData.set("projectId", data.project.id);
        formData.set("columnId", columnId);
        formData.set("title", title);
        const result = await createCardAction(null, formData);
        if (!result.ok) {
          toast.error(result.error);
          return false;
        }
        router.refresh();
        return true;
      } finally {
        endSave();
      }
    },
    [beginSave, data.project.id, endSave, router]
  );

  const updateCard = React.useCallback(
    async (cardId: string, patch: CardPatch) => {
      const snapshot = data;
      const existing = data.cards.find((card) => card.id === cardId);

      beginSave();
      try {
        if (existing) {
          const nextLabels =
            patch.labelIds !== undefined
              ? data.labels.filter((label) => patch.labelIds?.includes(label.id))
              : existing.labels;
          const nextAssignees =
            patch.assigneeIds !== undefined
              ? data.members
                  .filter((member) =>
                    patch.assigneeIds?.includes(member.user.id)
                  )
                  .map((member) => member.user)
              : existing.assignees;
          const nextFieldValues = patch.fieldValues
            ? { ...existing.fieldValues, ...patch.fieldValues }
            : existing.fieldValues;

          setData((prev) => ({
            ...prev,
            cards: prev.cards.map((card) =>
              card.id === cardId
                ? {
                    ...card,
                    title: patch.title ?? card.title,
                    description: patch.description ?? card.description,
                    priority: patch.priority ?? card.priority,
                    dueAt:
                      patch.dueAt !== undefined ? patch.dueAt : card.dueAt,
                    labels: nextLabels,
                    assignees: nextAssignees,
                    fieldValues: nextFieldValues,
                  }
                : card
            ),
          }));
        }

        const result = await updateCardAction({
          projectId: data.project.id,
          cardId,
          ...patch,
        });

        if (!result.ok) {
          setData(snapshot);
          toast.error(result.error);
          return false;
        }
        if (result.data?.automationApplied) {
          router.refresh();
        }
        return true;
      } finally {
        endSave();
      }
    },
    [beginSave, data, endSave, router]
  );

  const moveCard = React.useCallback(
    async (
      cardId: string,
      targetColumnId: string,
      beforeCardId?: string | null,
      afterCardId?: string | null,
      targetIndex?: number
    ) => {
      setData((prev) => ({
        ...prev,
        cards: applyLocalMove(
          prev.cards,
          cardId,
          targetColumnId,
          beforeCardId,
          afterCardId,
          targetIndex
        ),
      }));

      beginSave();
      try {
        const task = moveQueue.current.then(async () => {
          const result = await moveCardAction({
            projectId: data.project.id,
            cardId,
            targetColumnId,
            beforeCardId: beforeCardId ?? null,
            afterCardId: afterCardId ?? null,
            targetIndex,
          });

          if (!result.ok) {
            toast.error(result.error);
            router.refresh();
            return false;
          }
          if (result.data?.automationApplied) {
            router.refresh();
          }
          return true;
        });

        moveQueue.current = task.then(
          () => undefined,
          () => undefined
        );

        return await task;
      } catch {
        toast.error("保存失败，请重试");
        router.refresh();
        return false;
      } finally {
        endSave();
      }
    },
    [beginSave, data.project.id, endSave, router]
  );

  const archiveCard = React.useCallback(
    async (cardId: string) => {
      const snapshot = data;
      setData((prev) => ({
        ...prev,
        cards: prev.cards.filter((card) => card.id !== cardId),
      }));
      setSelectedCardId(null);

      beginSave();
      try {
        const result = await archiveCardAction({
          projectId: data.project.id,
          cardId,
          archived: true,
        });

        if (!result.ok) {
          setData(snapshot);
          toast.error(result.error);
          return false;
        }
        toast.success("卡片已归档");
        router.refresh();
        return true;
      } finally {
        endSave();
      }
    },
    [beginSave, data, endSave, router]
  );

  const value: BoardContextValue = {
    data,
    projectId: data.project.id,
    canEdit: data.canEdit,
    canManage: data.canManage,
    selectedCardId,
    openCard,
    closeCard,
    filters,
    setFilters,
    resetFilters,
    isDragging,
    setIsDragging,
    isRefreshing,
    isSaving: pendingSaves > 0,
    lastRefreshedAt,
    refresh,
    createCard,
    updateCard,
    moveCard,
    archiveCard,
  };

  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}
