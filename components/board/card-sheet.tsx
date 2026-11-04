"use client";

import * as React from "react";
import {
  Archive,
  Loader2,
  MessageSquare,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  createCommentAction,
  deleteCommentAction,
  loadCardDetailAction,
  updateCommentAction,
} from "@/lib/actions/board";
import { PRIORITIES } from "@/lib/constants";
import { useBoard } from "@/components/board/board-provider";
import { AssigneePicker } from "@/components/board/assignee-picker";
import { FieldInput } from "@/components/board/field-input";
import { LabelsPicker } from "@/components/board/labels-picker";
import { PriorityIcon } from "@/components/board/priority-icon";
import { DateTimePicker } from "@/components/shared/date-time-picker";
import { LocalDate } from "@/components/shared/local-date";
import { Markdown } from "@/components/shared/markdown";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { CardDetail, Priority } from "@/lib/types";

const ACTIVITY_LABELS: Record<string, string> = {
  "project.created": "创建了项目",
  "project.updated": "更新了项目",
  "project.archived": "归档了项目",
  "project.restored": "恢复了项目",
  "project.member_added": "添加了成员",
  "project.member_removed": "移除了成员",
  "project.member_role_changed": "修改了成员角色",
  "project.owner_transferred": "转让了所有权",
  "column.created": "创建了列",
  "column.updated": "更新了列",
  "column.deleted": "删除了列",
  "column.reordered": "调整了列顺序",
  "card.created": "创建了卡片",
  "card.updated": "更新了卡片",
  "card.moved": "移动了卡片",
  "card.archived": "归档了卡片",
  "card.restored": "恢复了卡片",
  "card.deleted": "删除了卡片",
  "comment.created": "添加了评论",
  "comment.updated": "编辑了评论",
  "comment.deleted": "删除了评论",
  "automation.run": "执行了自动化",
};

export function CardSheet() {
  const {
    data,
    projectId,
    selectedCardId,
    closeCard,
    updateCard,
    moveCard,
    archiveCard,
  } = useBoard();

  const [detail, setDetail] = React.useState<CardDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [descriptionDraft, setDescriptionDraft] = React.useState("");
  const [descriptionTab, setDescriptionTab] = React.useState<"edit" | "preview">(
    "edit"
  );
  const [commentDraft, setCommentDraft] = React.useState("");
  const [commentPending, startComment] = React.useTransition();
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(null);
  const [commentEditDraft, setCommentEditDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!selectedCardId) return;
    setLoading(true);
    setError(null);
    const result = await loadCardDetailAction({ projectId, cardId: selectedCardId });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      setDetail(null);
      return;
    }
    if (result.data) {
      setDetail(result.data);
      setTitleDraft(result.data.card.title);
      setDescriptionDraft(result.data.card.description);
    }
  }, [projectId, selectedCardId]);

  React.useEffect(() => {
    if (selectedCardId) {
      void reload();
    } else {
      setDetail(null);
      setError(null);
    }
  }, [selectedCardId, reload]);

  const card = detail?.card ?? null;

  async function saveTitle() {
    if (!card) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setTitleDraft(card.title);
      return;
    }
    if (trimmed === card.title) return;

    setSaving(true);
    const ok = await updateCard(card.id, { title: trimmed });
    setSaving(false);
    if (ok) {
      setDetail((prev) =>
        prev ? { ...prev, card: { ...prev.card, title: trimmed } } : prev
      );
    } else {
      setTitleDraft(card.title);
    }
  }

  async function saveDescription() {
    if (!card) return;
    if (descriptionDraft === card.description) return;

    setSaving(true);
    const ok = await updateCard(card.id, { description: descriptionDraft });
    setSaving(false);
    if (ok) {
      setDetail((prev) =>
        prev
          ? { ...prev, card: { ...prev.card, description: descriptionDraft } }
          : prev
      );
    }
  }

  async function patchCard(patch: {
    priority?: Priority;
    dueAt?: string | null;
    labelIds?: string[];
    assigneeIds?: string[];
    fieldValues?: Record<string, unknown>;
  }) {
    if (!card) return;
    setSaving(true);
    const ok = await updateCard(card.id, patch);
    setSaving(false);
    if (!ok) return;

    setDetail((prev) => {
      if (!prev) return prev;
      const next = { ...prev.card };
      if (patch.priority !== undefined) next.priority = patch.priority;
      if (patch.dueAt !== undefined) next.dueAt = patch.dueAt;
      if (patch.labelIds !== undefined) {
        next.labels = data.labels.filter((label) =>
          patch.labelIds?.includes(label.id)
        );
      }
      if (patch.assigneeIds !== undefined) {
        next.assignees = data.members
          .filter((member) => patch.assigneeIds?.includes(member.user.id))
          .map((member) => member.user);
      }
      if (patch.fieldValues) {
        next.fieldValues = { ...next.fieldValues, ...patch.fieldValues };
      }
      return { ...prev, card: next };
    });
  }

  async function changeColumn(targetColumnId: string) {
    if (!card || targetColumnId === card.columnId) return;
    setSaving(true);
    const ok = await moveCard(card.id, targetColumnId, null, null, 9999);
    setSaving(false);
    if (ok) {
      setDetail((prev) =>
        prev ? { ...prev, card: { ...prev.card, columnId: targetColumnId } } : prev
      );
    }
  }

  function submitComment() {
    if (!card) return;
    const body = commentDraft.trim();
    if (!body) return;

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("cardId", card.id);
    formData.set("body", body);

    startComment(async () => {
      const result = await createCommentAction(null, formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCommentDraft("");
      await reload();
    });
  }

  async function saveComment(commentId: string) {
    const body = commentEditDraft.trim();
    if (!body) return;
    const result = await updateCommentAction({ projectId, commentId, body });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setEditingCommentId(null);
    setCommentEditDraft("");
    await reload();
  }

  async function removeComment(commentId: string) {
    const result = await deleteCommentAction({ projectId, commentId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    await reload();
  }

  const canDeleteAnyComment = data.role === "owner" || data.isAdmin;

  return (
    <Sheet open={Boolean(selectedCardId)} onOpenChange={(open) => !open && closeCard()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="sr-only">卡片详情</SheetTitle>
          {loading && !detail ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ) : card ? (
            <div className="space-y-3 pr-8">
              {data.canEdit ? (
                <Input
                  value={titleDraft}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => void saveTitle()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  className="h-auto border-0 px-0 py-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                />
              ) : (
                <p className="text-lg font-semibold break-words">{card.title}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>创建于 <LocalDate value={card.createdAt} /></span>
                <span>·</span>
                <span>进入本列 <LocalDate value={card.columnEnteredAt} /></span>
                {card.archivedAt ? (
                  <>
                    <span>·</span>
                    <span>
                      归档于 <LocalDate value={card.archivedAt} />
                    </span>
                  </>
                ) : null}
                {saving ? (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="size-3 animate-spin" />
                    保存中
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </SheetHeader>

        {error ? (
          <div className="p-5 text-sm text-destructive">{error}</div>
        ) : !detail || !card ? (
          loading ? (
            <div className="space-y-4 p-5">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null
        ) : (
          <div className="space-y-6 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>所属列</Label>
                <Select
                  value={card.columnId ?? ""}
                  onValueChange={(value) => void changeColumn(value)}
                  disabled={!data.canEdit}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择列" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>优先级</Label>
                <Select
                  value={card.priority}
                  onValueChange={(value) =>
                    void patchCard({ priority: value as Priority })
                  }
                  disabled={!data.canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority.value} value={priority.value}>
                        <span className="flex items-center gap-2">
                          <PriorityIcon priority={priority.value} className="size-3.5" />
                          {priority.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>截止时间</Label>
                <DateTimePicker
                  value={card.dueAt}
                  onChange={(dueAt) => void patchCard({ dueAt })}
                  disabled={!data.canEdit}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>负责人</Label>
                <AssigneePicker
                  members={data.members.map((member) => member.user)}
                  selectedIds={card.assignees.map((assignee) => assignee.id)}
                  onChange={(ids) => void patchCard({ assigneeIds: ids })}
                  disabled={!data.canEdit}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>标签</Label>
                <LabelsPicker
                  labels={data.labels}
                  selectedIds={card.labels.map((label) => label.id)}
                  onChange={(ids) => void patchCard({ labelIds: ids })}
                  disabled={!data.canEdit}
                />
              </div>

              {data.fields.length > 0 ? (
                <div className="space-y-4 sm:col-span-2">
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {data.fields.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label>{field.name}</Label>
                        <FieldInput
                          field={field}
                          value={card.fieldValues[field.id]}
                          members={data.members.map((member) => member.user)}
                          onChange={(value) =>
                            void patchCard({ fieldValues: { [field.id]: value } })
                          }
                          disabled={!data.canEdit}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>描述</Label>
                {data.canEdit ? (
                  <Tabs
                    value={descriptionTab}
                    onValueChange={(value) =>
                      setDescriptionTab(value as "edit" | "preview")
                    }
                  >
                    <TabsList className="h-7">
                      <TabsTrigger value="edit" className="text-xs">
                        编辑
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="text-xs">
                        预览
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}
              </div>

              {descriptionTab === "edit" && data.canEdit ? (
                <div className="space-y-2">
                  <Textarea
                    value={descriptionDraft}
                    onChange={(event) => setDescriptionDraft(event.target.value)}
                    rows={6}
                    placeholder="支持 Markdown"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving || descriptionDraft === card.description}
                      onClick={() => void saveDescription()}
                    >
                      保存描述
                    </Button>
                  </div>
                </div>
              ) : (
                <Markdown>{card.description}</Markdown>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-muted-foreground" />
                <Label>评论</Label>
                <span className="text-xs text-muted-foreground">
                  {detail.comments.length}
                </span>
              </div>

              <div className="space-y-3">
                {detail.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">还没有评论。</p>
                ) : (
                  detail.comments.map((comment) => {
                    const isOwn = comment.user?.id === data.currentUser.id;
                    const canDelete = isOwn || canDeleteAnyComment;
                    return (
                      <div key={comment.id} className="flex gap-2">
                        {comment.user ? (
                          <UserAvatar
                            id={comment.user.id}
                            name={comment.user.displayName}
                            size="sm"
                          />
                        ) : (
                          <div className="size-6 rounded-full bg-muted" />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">
                              {comment.user?.displayName ?? "系统"}
                            </span>
                            <LocalDate
                              value={comment.createdAt}
                              relative
                              className="text-[10px] text-muted-foreground"
                            />
                            {(isOwn || canDelete) && data.canEdit ? (
                              <div className="ml-auto flex items-center gap-1">
                                {isOwn ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-6"
                                    onClick={() => {
                                      setEditingCommentId(comment.id);
                                      setCommentEditDraft(comment.body);
                                    }}
                                    aria-label="编辑评论"
                                  >
                                    <Pencil className="size-3" />
                                  </Button>
                                ) : null}
                                {canDelete ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-muted-foreground hover:text-destructive"
                                    onClick={() => void removeComment(comment.id)}
                                    aria-label="删除评论"
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {editingCommentId === comment.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={commentEditDraft}
                                onChange={(event) =>
                                  setCommentEditDraft(event.target.value)
                                }
                                rows={2}
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingCommentId(null)}
                                >
                                  取消
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void saveComment(comment.id)}
                                >
                                  保存
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {data.canEdit ? (
                <div className="flex gap-2">
                  <Textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    rows={2}
                    placeholder="写下评论..."
                    className="min-h-16"
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="shrink-0 self-end"
                    disabled={commentPending || !commentDraft.trim()}
                    onClick={submitComment}
                    aria-label="发送评论"
                  >
                    {commentPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>活动</Label>
              {detail.activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无活动。</p>
              ) : (
                <div className="space-y-2">
                  {detail.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <span className="text-muted-foreground">
                        {activity.user?.displayName ?? "系统"} ·{" "}
                        {ACTIVITY_LABELS[activity.type] ?? activity.type}
                      </span>
                      <LocalDate
                        value={activity.createdAt}
                        relative
                        className="shrink-0 text-muted-foreground"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.canEdit ? (
              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-xs text-muted-foreground">
                  卡片 ID：{card.id}
                </span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Archive className="size-4" />
                      归档卡片
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>归档这张卡片？</AlertDialogTitle>
                      <AlertDialogDescription>
                        归档后卡片会从看板隐藏，可以在归档页恢复。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void archiveCard(card.id)}>
                        归档
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
