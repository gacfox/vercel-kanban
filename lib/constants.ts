import type { FieldType, Priority, ProjectRole } from "@/lib/types";

export const SESSION_COOKIE = "vk_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
export const SITE_NAME = "Kanban";
export const BOARD_HISTORY_PAGE_SIZE = 50;

export const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

export const ROLE_LABELS: Record<ProjectRole, string> = {
  viewer: "查看者",
  editor: "编辑者",
  owner: "所有者",
};

export const ROLE_BADGE_VARIANT: Record<
  ProjectRole,
  "default" | "secondary" | "outline"
> = {
  viewer: "outline",
  editor: "secondary",
  owner: "default",
};

export const PRIORITIES = [
  {
    value: "none",
    label: "无",
    icon: "minus",
    className: "text-muted-foreground",
    badgeClassName: "bg-muted text-muted-foreground",
  },
  {
    value: "low",
    label: "低",
    icon: "arrow-down",
    className: "text-sky-600 dark:text-sky-400",
    badgeClassName: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  {
    value: "medium",
    label: "中",
    icon: "equal",
    className: "text-amber-600 dark:text-amber-400",
    badgeClassName:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    value: "high",
    label: "高",
    icon: "arrow-up",
    className: "text-orange-600 dark:text-orange-400",
    badgeClassName:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  {
    value: "urgent",
    label: "紧急",
    icon: "flame",
    className: "text-red-600 dark:text-red-400",
    badgeClassName: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
] as const satisfies ReadonlyArray<{
  value: Priority;
  label: string;
  icon: string;
  className: string;
  badgeClassName: string;
}>;

export const PRIORITY_MAP = Object.fromEntries(
  PRIORITIES.map((p) => [p.value, p])
) as Record<Priority, (typeof PRIORITIES)[number]>;

export const PRIORITY_VALUES: Priority[] = PRIORITIES.map((p) => p.value);

export const LABEL_COLORS = [
  {
    key: "slate",
    label: "石板灰",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    dot: "bg-slate-500",
  },
  {
    key: "red",
    label: "红",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    dot: "bg-red-500",
  },
  {
    key: "orange",
    label: "橙",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  {
    key: "amber",
    label: "琥珀",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  {
    key: "green",
    label: "绿",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    dot: "bg-green-500",
  },
  {
    key: "teal",
    label: "青",
    className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  {
    key: "blue",
    label: "蓝",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  {
    key: "violet",
    label: "紫",
    className:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  {
    key: "pink",
    label: "粉",
    className: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  {
    key: "gray",
    label: "灰",
    className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
    dot: "bg-gray-500",
  },
] as const;

export type LabelColorKey = (typeof LABEL_COLORS)[number]["key"];

export const LABEL_COLOR_MAP = Object.fromEntries(
  LABEL_COLORS.map((c) => [c.key, c])
) as Record<string, (typeof LABEL_COLORS)[number]>;

export const LABEL_COLOR_KEYS = LABEL_COLORS.map((c) => c.key);

export const PROJECT_COLORS = [
  { key: "blue", label: "蓝", hex: "#3b82f6" },
  { key: "green", label: "绿", hex: "#22c55e" },
  { key: "violet", label: "紫", hex: "#8b5cf6" },
  { key: "orange", label: "橙", hex: "#f97316" },
  { key: "pink", label: "粉", hex: "#ec4899" },
  { key: "teal", label: "青", hex: "#14b8a6" },
  { key: "red", label: "红", hex: "#ef4444" },
  { key: "amber", label: "琥珀", hex: "#f59e0b" },
  { key: "slate", label: "石板灰", hex: "#64748b" },
] as const;

export const PROJECT_COLOR_MAP = Object.fromEntries(
  PROJECT_COLORS.map((c) => [c.key, c])
) as Record<string, (typeof PROJECT_COLORS)[number]>;

export const PROJECT_COLOR_KEYS = PROJECT_COLORS.map((c) => c.key);

export const FIELD_TYPES = [
  { value: "text", label: "文本", icon: "type" },
  { value: "long_text", label: "长文本", icon: "align-left" },
  { value: "number", label: "数字", icon: "hash" },
  { value: "date", label: "日期", icon: "calendar" },
  { value: "select", label: "单选", icon: "circle-dot" },
  { value: "multi_select", label: "多选", icon: "list-checks" },
  { value: "checkbox", label: "复选框", icon: "square-check" },
  { value: "url", label: "链接", icon: "link" },
  { value: "user", label: "成员", icon: "user" },
] as const satisfies ReadonlyArray<{
  value: FieldType;
  label: string;
  icon: string;
}>;

export const FIELD_TYPE_MAP = Object.fromEntries(
  FIELD_TYPES.map((f) => [f.value, f])
) as Record<FieldType, (typeof FIELD_TYPES)[number]>;

export const FIELD_TYPE_VALUES: FieldType[] = FIELD_TYPES.map((f) => f.value);

export const DEFAULT_COLUMNS = [
  { title: "待办", position: 1000, isDone: false },
  { title: "进行中", position: 2000, isDone: false },
  { title: "已完成", position: 3000, isDone: true },
] as const;

export const MAX_TITLE_LENGTH = 500;
export const MAX_DESCRIPTION_LENGTH = 20000;
export const MAX_COMMENT_LENGTH = 10000;
export const MAX_FIELD_OPTIONS = 100;

export const SORT_STEP = 1000;
