"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Bot,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createAutomationAction,
  deleteAutomationAction,
  toggleAutomationAction,
  updateAutomationAction,
} from "@/lib/actions/automations";
import { PRIORITIES } from "@/lib/constants";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { LocalDate } from "@/components/shared/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  Automation,
  AutomationRun,
} from "@/lib/db/queries/automations";
import type {
  BoardColumn,
  CustomField,
  Label as LabelType,
  ProjectMember,
} from "@/lib/types";

const TRIGGER_LABELS: Record<string, string> = {
  "card.created": "卡片创建时",
  "card.moved": "卡片移动列时",
  "card.updated": "卡片字段更新时",
  "card.due_soon": "每天：即将到期",
  "card.overdue": "每天：已逾期",
  "card.stale_in_column": "每天：在某列停留过久",
};

const CONDITION_LABELS: Record<string, string> = {
  in_column: "当前列",
  label_includes: "包含标签",
  label_excludes: "不包含标签",
  priority_in: "优先级",
  assignee_in: "负责人",
  title_contains: "标题包含",
  due_within_days: "截止在 N 天内",
  field_equals: "自定义字段等于",
};

const ACTION_LABELS: Record<string, string> = {
  move_to_column: "移动到列",
  add_label: "添加标签",
  remove_label: "移除标签",
  set_priority: "设置优先级",
  set_assignee: "添加负责人",
  clear_assignees: "清空负责人",
  set_due_at: "设置截止时间",
  clear_due_at: "清空截止时间",
  archive_card: "归档卡片",
  add_comment: "添加评论",
};

type ConditionState = {
  type: string;
  columnId: string;
  labelId: string;
  priority: string;
  userId: string;
  text: string;
  days: number;
  fieldId: string;
  value: string;
};

type ActionState = {
  type: string;
  columnId: string;
  labelId: string;
  priority: string;
  userId: string;
  days: number;
  body: string;
};

function emptyCondition(): ConditionState {
  return {
    type: "in_column",
    columnId: "",
    labelId: "",
    priority: "",
    userId: "",
    text: "",
    days: 3,
    fieldId: "",
    value: "",
  };
}

function emptyAction(): ActionState {
  return {
    type: "move_to_column",
    columnId: "",
    labelId: "",
    priority: "medium",
    userId: "",
    days: 7,
    body: "",
  };
}

export function AutomationSettings({
  projectId,
  automations,
  runs,
  columns,
  labels,
  fields,
  members,
  canManage,
  archived,
}: {
  projectId: string;
  automations: Automation[];
  runs: AutomationRun[];
  columns: BoardColumn[];
  labels: LabelType[];
  fields: CustomField[];
  members: ProjectMember[];
  canManage: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Automation | null>(null);

  async function toggle(rule: Automation, enabled: boolean) {
    const result = await toggleAutomationAction(projectId, rule.id, enabled);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.refresh();
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(rule: Automation) {
    setEditing(rule);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-4" />
              自动化规则
            </CardTitle>
            <CardDescription>
              事件规则即时执行；到期/停留类规则由每日 cron 检查。
            </CardDescription>
          </div>
          {canManage && !archived ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              新建规则
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {automations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              还没有自动化规则。
            </div>
          ) : (
            automations.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{rule.name}</p>
                    <Badge variant="outline">
                      {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
                    </Badge>
                    <Badge variant="secondary">
                      {rule.actions.length} 个动作
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {describeTrigger(rule)} → {describeActions(rule, labels, columns, members, fields)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(enabled) => void toggle(rule, enabled)}
                    disabled={!canManage || archived}
                    aria-label="启用规则"
                  />
                  {canManage && !archived ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => openEdit(rule)}
                        aria-label="编辑规则"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <ConfirmAction
                        title="删除自动化规则？"
                        description={`删除「${rule.name}」后不再执行，历史运行记录会保留 30 天。`}
                        confirmLabel="删除"
                        destructive
                        onConfirm={async () => {
                          const result = await deleteAutomationAction(
                            projectId,
                            rule.id
                          );
                          if (!result.ok) {
                            toast.error(result.error);
                            return;
                          }
                          toast.success("规则已删除");
                          router.refresh();
                        }}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label="删除规则"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </ConfirmAction>
                    </>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>运行记录</CardTitle>
          <CardDescription>最近 50 条，保留 30 天。</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无运行记录。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>规则</TableHead>
                  <TableHead>卡片</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>消息</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">
                      {run.automationName ?? "已删除规则"}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-sm">
                      {run.cardTitle ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "success"
                            ? "secondary"
                            : run.status === "error"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {run.status === "success"
                          ? "成功"
                          : run.status === "error"
                            ? "失败"
                            : "跳过"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <LocalDate value={run.createdAt} relative />
                    </TableCell>
                    <TableCell className="max-w-60 truncate text-xs text-muted-foreground">
                      {run.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AutomationDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        projectId={projectId}
        editing={editing}
        columns={columns}
        labels={labels}
        fields={fields}
        members={members}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function describeTrigger(rule: Automation): string {
  const config = rule.triggerConfig;
  if (rule.triggerType === "card.moved") {
    return `移动到 ${config.toColumnId ? "指定列" : "任意列"}`;
  }
  if (rule.triggerType === "card.due_soon") {
    return `截止前 ${Number(config.days ?? 3)} 天`;
  }
  if (rule.triggerType === "card.stale_in_column") {
    return `停留超过 ${Number(config.days ?? 30)} 天`;
  }
  return TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType;
}

function describeActions(
  rule: Automation,
  labels: LabelType[],
  columns: BoardColumn[],
  members: ProjectMember[],
  fields: CustomField[]
): string {
  const actions = rule.actions as Array<Record<string, unknown>>;
  return actions
    .map((action) => {
      const type = String(action.type);
      if (type === "move_to_column") {
        return `移动到「${columns.find((c) => c.id === action.columnId)?.title ?? "未知列"}」`;
      }
      if (type === "add_label" || type === "remove_label") {
        return `${type === "add_label" ? "加" : "移除"}标签「${
          labels.find((l) => l.id === action.labelId)?.name ?? "未知标签"
        }」`;
      }
      if (type === "set_assignee") {
        return `添加负责人「${
          members.find((m) => m.user.id === action.userId)?.user.displayName ?? "未知成员"
        }」`;
      }
      if (type === "field_equals") {
        return `字段「${fields.find((f) => f.id === action.fieldId)?.name ?? "未知"}」`;
      }
      return ACTION_LABELS[type] ?? type;
    })
    .join("、");
}

function AutomationDialog({
  open,
  onOpenChange,
  projectId,
  editing,
  columns,
  labels,
  fields,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  editing: Automation | null;
  columns: BoardColumn[];
  labels: LabelType[];
  fields: CustomField[];
  members: ProjectMember[];
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [triggerType, setTriggerType] = React.useState("card.created");
  const [toColumnId, setToColumnId] = React.useState("");
  const [fromColumnId, setFromColumnId] = React.useState("");
  const [days, setDays] = React.useState(3);
  const [staleColumnId, setStaleColumnId] = React.useState("");
  const [updatedFields, setUpdatedFields] = React.useState<string[]>([]);
  const [conditions, setConditions] = React.useState<ConditionState[]>([]);
  const [actions, setActions] = React.useState<ActionState[]>([emptyAction()]);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (!editing) {
      setName("");
      setEnabled(true);
      setTriggerType("card.created");
      setToColumnId("");
      setFromColumnId("");
      setDays(3);
      setStaleColumnId("");
      setUpdatedFields([]);
      setConditions([]);
      setActions([emptyAction()]);
      return;
    }

    setName(editing.name);
    setEnabled(editing.enabled);
    setTriggerType(editing.triggerType);
    const config = editing.triggerConfig;
    setToColumnId(typeof config.toColumnId === "string" ? config.toColumnId : "");
    setFromColumnId(
      typeof config.fromColumnId === "string" ? config.fromColumnId : ""
    );
    setDays(
      typeof config.days === "number" ? config.days : Number(config.days ?? 3)
    );
    setStaleColumnId(
      typeof config.columnId === "string" ? config.columnId : ""
    );
    setUpdatedFields(
      Array.isArray(config.fields) ? (config.fields as string[]) : []
    );
    setConditions(
      (editing.conditions as Array<Record<string, unknown>>).map((condition) => ({
        type: String(condition.type),
        columnId:
          Array.isArray(condition.columnIds) && condition.columnIds[0]
            ? String(condition.columnIds[0])
            : "",
        labelId:
          Array.isArray(condition.labelIds) && condition.labelIds[0]
            ? String(condition.labelIds[0])
            : "",
        priority:
          Array.isArray(condition.values) && condition.values[0]
            ? String(condition.values[0])
            : "",
        userId:
          Array.isArray(condition.userIds) && condition.userIds[0]
            ? String(condition.userIds[0])
            : "",
        text: typeof condition.text === "string" ? condition.text : "",
        days: Number(condition.days ?? 3),
        fieldId: typeof condition.fieldId === "string" ? condition.fieldId : "",
        value: typeof condition.value === "string" ? condition.value : "",
      }))
    );
    setActions(
      (editing.actions as Array<Record<string, unknown>>).map((action) => ({
        type: String(action.type),
        columnId: typeof action.columnId === "string" ? action.columnId : "",
        labelId: typeof action.labelId === "string" ? action.labelId : "",
        priority: typeof action.priority === "string" ? action.priority : "medium",
        userId: typeof action.userId === "string" ? action.userId : "",
        days: Number(action.days ?? 7),
        body: typeof action.body === "string" ? action.body : "",
      }))
    );
  }, [open, editing]);

  function buildInput() {
    const triggerConfig: Record<string, unknown> = {};
    if (triggerType === "card.moved") {
      if (fromColumnId) triggerConfig.fromColumnId = fromColumnId;
      if (toColumnId) triggerConfig.toColumnId = toColumnId;
    } else if (triggerType === "card.due_soon") {
      triggerConfig.days = days;
    } else if (triggerType === "card.stale_in_column") {
      triggerConfig.columnId = staleColumnId;
      triggerConfig.days = days;
    } else if (triggerType === "card.updated") {
      triggerConfig.fields = updatedFields;
    }

    return {
      projectId,
      automationId: editing?.id,
      name,
      enabled,
      triggerType,
      triggerConfig,
      conditions: conditions.map((condition) => {
        if (condition.type === "in_column") {
          return { type: condition.type, columnIds: [condition.columnId] };
        }
        if (condition.type === "label_includes" || condition.type === "label_excludes") {
          return { type: condition.type, labelIds: [condition.labelId] };
        }
        if (condition.type === "priority_in") {
          return { type: condition.type, values: [condition.priority] };
        }
        if (condition.type === "assignee_in") {
          return { type: condition.type, userIds: [condition.userId] };
        }
        if (condition.type === "title_contains") {
          return { type: condition.type, text: condition.text };
        }
        if (condition.type === "due_within_days") {
          return { type: condition.type, days: condition.days };
        }
        return {
          type: condition.type,
          fieldId: condition.fieldId,
          value: condition.value,
        };
      }),
      actions: actions.map((action) => {
        if (action.type === "move_to_column") {
          return { type: action.type, columnId: action.columnId };
        }
        if (action.type === "add_label" || action.type === "remove_label") {
          return { type: action.type, labelId: action.labelId };
        }
        if (action.type === "set_priority") {
          return { type: action.type, priority: action.priority };
        }
        if (action.type === "set_assignee") {
          return { type: action.type, userId: action.userId };
        }
        if (action.type === "set_due_at") {
          return { type: action.type, mode: "offset_days", days: action.days };
        }
        if (action.type === "add_comment") {
          return { type: action.type, body: action.body };
        }
        return { type: action.type };
      }),
    };
  }

  async function save() {
    setPending(true);
    const input = buildInput();
    const result = editing
      ? await updateAutomationAction(input)
      : await createAutomationAction(input);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(editing ? "规则已更新" : "规则已创建");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑自动化规则" : "新建自动化规则"}</DialogTitle>
          <DialogDescription>
            触发器 + 条件（全部满足）+ 有序动作。事件类即时执行，每日类由 cron 检查。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>规则名称</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="rule-enabled" />
              <Label htmlFor="rule-enabled">启用</Label>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>触发器</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {triggerType === "card.moved" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>从列（可选）</Label>
                  <Select value={fromColumnId || "any"} onValueChange={(value) => setFromColumnId(value === "any" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">任意列</SelectItem>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>到列（可选）</Label>
                  <Select value={toColumnId || "any"} onValueChange={(value) => setToColumnId(value === "any" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">任意列</SelectItem>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {triggerType === "card.due_soon" ? (
              <div className="space-y-2">
                <Label>提前天数</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                />
              </div>
            ) : null}

            {triggerType === "card.stale_in_column" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>列</Label>
                  <Select value={staleColumnId} onValueChange={setStaleColumnId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择列" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((column) => (
                        <SelectItem key={column.id} value={column.id}>
                          {column.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>停留天数</Label>
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={days}
                    onChange={(event) => setDays(Number(event.target.value))}
                  />
                </div>
              </div>
            ) : null}

            {triggerType === "card.updated" ? (
              <div className="flex flex-wrap gap-3">
                {[
                  ["due_at", "截止时间"],
                  ["priority", "优先级"],
                  ["assignee", "负责人"],
                  ["labels", "标签"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={updatedFields.includes(value)}
                      onCheckedChange={(checked) =>
                        setUpdatedFields((prev) =>
                          checked
                            ? [...prev, value]
                            : prev.filter((item) => item !== value)
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>条件（全部满足）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConditions((prev) => [...prev, emptyCondition()])}
              >
                <Plus className="size-4" />
                添加条件
              </Button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-xs text-muted-foreground">无额外条件。</p>
            ) : (
              conditions.map((condition, index) => (
                <div key={index} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Select
                      value={condition.type}
                      onValueChange={(value) =>
                        setConditions((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, type: value } : item
                          )
                        )
                      }
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto size-8"
                      onClick={() =>
                        setConditions((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      aria-label="删除条件"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>

                  <ConditionConfig
                    condition={condition}
                    onChange={(next) =>
                      setConditions((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? next : item
                        )
                      )
                    }
                    columns={columns}
                    labels={labels}
                    fields={fields}
                    members={members}
                  />
                </div>
              ))
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>动作（按顺序执行）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActions((prev) => [...prev, emptyAction()])}
              >
                <Plus className="size-4" />
                添加动作
              </Button>
            </div>
            {actions.map((action, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={action.type}
                    onValueChange={(value) =>
                      setActions((prev) =>
                        prev.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, type: value } : item
                        )
                      )
                    }
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === 0}
                      onClick={() =>
                        setActions((prev) => {
                          const next = [...prev];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        })
                      }
                      aria-label="上移动作"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={index === actions.length - 1}
                      onClick={() =>
                        setActions((prev) => {
                          const next = [...prev];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return next;
                        })
                      }
                      aria-label="下移动作"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        setActions((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      aria-label="删除动作"
                      disabled={actions.length === 1}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>

                <ActionConfig
                  action={action}
                  onChange={(next) =>
                    setActions((prev) =>
                      prev.map((item, itemIndex) =>
                        itemIndex === index ? next : item
                      )
                    )
                  }
                  columns={columns}
                  labels={labels}
                  members={members}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={() => void save()} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            保存规则
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConditionConfig({
  condition,
  onChange,
  columns,
  labels,
  fields,
  members,
}: {
  condition: ConditionState;
  onChange: (condition: ConditionState) => void;
  columns: BoardColumn[];
  labels: LabelType[];
  fields: CustomField[];
  members: ProjectMember[];
}) {
  if (condition.type === "in_column") {
    return (
      <Select
        value={condition.columnId}
        onValueChange={(value) => onChange({ ...condition, columnId: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择列" />
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (condition.type === "label_includes" || condition.type === "label_excludes") {
    return (
      <Select
        value={condition.labelId}
        onValueChange={(value) => onChange({ ...condition, labelId: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择标签" />
        </SelectTrigger>
        <SelectContent>
          {labels.map((label) => (
            <SelectItem key={label.id} value={label.id}>
              {label.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (condition.type === "priority_in") {
    return (
      <Select
        value={condition.priority}
        onValueChange={(value) => onChange({ ...condition, priority: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择优先级" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((priority) => (
            <SelectItem key={priority.value} value={priority.value}>
              {priority.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (condition.type === "assignee_in") {
    return (
      <Select
        value={condition.userId}
        onValueChange={(value) => onChange({ ...condition, userId: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择成员" />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.user.id} value={member.user.id}>
              {member.user.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (condition.type === "title_contains") {
    return (
      <Input
        value={condition.text}
        onChange={(event) => onChange({ ...condition, text: event.target.value })}
        placeholder="标题包含的文本"
      />
    );
  }
  if (condition.type === "due_within_days") {
    return (
      <Input
        type="number"
        min={1}
        max={365}
        value={condition.days}
        onChange={(event) =>
          onChange({ ...condition, days: Number(event.target.value) })
        }
      />
    );
  }
  if (condition.type === "field_equals") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          value={condition.fieldId}
          onValueChange={(value) => onChange({ ...condition, fieldId: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择字段" />
          </SelectTrigger>
          <SelectContent>
            {fields.map((field) => (
              <SelectItem key={field.id} value={field.id}>
                {field.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={condition.value}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
          placeholder="值"
        />
      </div>
    );
  }
  return null;
}

function ActionConfig({
  action,
  onChange,
  columns,
  labels,
  members,
}: {
  action: ActionState;
  onChange: (action: ActionState) => void;
  columns: BoardColumn[];
  labels: LabelType[];
  members: ProjectMember[];
}) {
  if (action.type === "move_to_column") {
    return (
      <Select
        value={action.columnId}
        onValueChange={(value) => onChange({ ...action, columnId: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择目标列" />
        </SelectTrigger>
        <SelectContent>
          {columns.map((column) => (
            <SelectItem key={column.id} value={column.id}>
              {column.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (action.type === "add_label" || action.type === "remove_label") {
    return (
      <Select
        value={action.labelId}
        onValueChange={(value) => onChange({ ...action, labelId: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择标签" />
        </SelectTrigger>
        <SelectContent>
          {labels.map((label) => (
            <SelectItem key={label.id} value={label.id}>
              {label.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (action.type === "set_priority") {
    return (
      <Select
        value={action.priority}
        onValueChange={(value) => onChange({ ...action, priority: value })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITIES.map((priority) => (
            <SelectItem key={priority.value} value={priority.value}>
              {priority.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (action.type === "set_assignee") {
    return (
      <Select
        value={action.userId}
        onValueChange={(value) => onChange({ ...action, userId: value })}
      >
        <SelectTrigger>
          <SelectValue placeholder="选择成员" />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.user.id} value={member.user.id}>
              {member.user.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (action.type === "set_due_at") {
    return (
      <Input
        type="number"
        min={1}
        max={3650}
        value={action.days}
        onChange={(event) => onChange({ ...action, days: Number(event.target.value) })}
        placeholder="从现在起多少天"
      />
    );
  }
  if (action.type === "add_comment") {
    return (
      <Textarea
        value={action.body}
        onChange={(event) => onChange({ ...action, body: event.target.value })}
        rows={2}
        placeholder="评论内容"
      />
    );
  }
  return null;
}
