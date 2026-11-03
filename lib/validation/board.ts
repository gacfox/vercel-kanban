import { z } from "zod";
import {
  FIELD_TYPE_VALUES,
  LABEL_COLOR_KEYS,
  PRIORITY_VALUES,
} from "@/lib/constants";

const uuid = z.string().uuid();
const optionalText = z.string().trim().max(2000).optional();
const optionalInt = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number().int().min(1).max(max).nullable()
  );

export const columnCreateSchema = z.object({
  projectId: uuid,
  title: z.string().trim().min(1, "请输入列名称").max(100),
  wipLimit: optionalInt(9999).optional(),
  historyWindowDays: optionalInt(3650).optional(),
  isDone: z.coerce.boolean().optional().default(false),
});

export const columnUpdateSchema = z.object({
  projectId: uuid,
  columnId: uuid,
  title: z.string().trim().min(1, "请输入列名称").max(100),
  wipLimit: optionalInt(9999),
  historyWindowDays: optionalInt(3650),
  isDone: z.coerce.boolean(),
});

export const columnReorderSchema = z.object({
  projectId: uuid,
  columnId: uuid,
  beforeColumnId: uuid.nullable().optional(),
  afterColumnId: uuid.nullable().optional(),
});

export const columnDeleteSchema = z.object({
  projectId: uuid,
  columnId: uuid,
  strategy: z.enum(["move", "archive"]),
  targetColumnId: uuid.nullable().optional(),
});

export const cardCreateSchema = z.object({
  projectId: uuid,
  columnId: uuid,
  title: z.string().trim().min(1, "请输入卡片标题").max(500),
  description: z.string().max(20000).optional().default(""),
  priority: z.enum(PRIORITY_VALUES as [string, ...string[]]).optional().default("none"),
  dueAt: z.string().nullable().optional(),
  labelIds: z.array(uuid).max(50).optional().default([]),
  assigneeIds: z.array(uuid).max(50).optional().default([]),
  fieldValues: z.record(z.string(), z.unknown()).optional().default({}),
});

export const cardUpdateSchema = z.object({
  projectId: uuid,
  cardId: uuid,
  title: z.string().trim().min(1, "请输入卡片标题").max(500).optional(),
  description: z.string().max(20000).optional(),
  priority: z.enum(PRIORITY_VALUES as [string, ...string[]]).optional(),
  dueAt: z.string().nullable().optional(),
  labelIds: z.array(uuid).max(50).optional(),
  assigneeIds: z.array(uuid).max(50).optional(),
  fieldValues: z.record(z.string(), z.unknown()).optional(),
});

export const cardMoveSchema = z.object({
  projectId: uuid,
  cardId: uuid,
  targetColumnId: uuid,
  beforeCardId: uuid.nullable().optional(),
  afterCardId: uuid.nullable().optional(),
  targetIndex: z.coerce.number().int().min(0).optional(),
});

export const cardArchiveSchema = z.object({
  projectId: uuid,
  cardId: uuid,
  archived: z.coerce.boolean(),
});

export const cardDeleteSchema = z.object({
  projectId: uuid,
  cardId: uuid,
});

export const commentCreateSchema = z.object({
  projectId: uuid,
  cardId: uuid,
  body: z.string().trim().min(1, "请输入评论内容").max(10000),
});

export const commentUpdateSchema = z.object({
  projectId: uuid,
  commentId: uuid,
  body: z.string().trim().min(1, "请输入评论内容").max(10000),
});

export const commentDeleteSchema = z.object({
  projectId: uuid,
  commentId: uuid,
});

export const labelCreateSchema = z.object({
  projectId: uuid,
  name: z.string().trim().min(1, "请输入标签名称").max(50),
  color: z.enum(LABEL_COLOR_KEYS as [string, ...string[]]).optional().default("slate"),
});

export const labelUpdateSchema = z.object({
  projectId: uuid,
  labelId: uuid,
  name: z.string().trim().min(1, "请输入标签名称").max(50),
  color: z.enum(LABEL_COLOR_KEYS as [string, ...string[]]),
});

export const labelDeleteSchema = z.object({
  projectId: uuid,
  labelId: uuid,
});

export const fieldCreateSchema = z.object({
  projectId: uuid,
  name: z.string().trim().min(1, "请输入字段名称").max(100),
  type: z.enum(FIELD_TYPE_VALUES as [string, ...string[]]),
  options: z.array(z.string().trim().min(1).max(100)).max(100).optional().default([]),
  showOnCard: z.coerce.boolean().optional().default(false),
});

export const fieldUpdateSchema = z.object({
  projectId: uuid,
  fieldId: uuid,
  name: z.string().trim().min(1, "请输入字段名称").max(100),
  options: z.array(z.string().trim().min(1).max(100)).max(100).optional().default([]),
  showOnCard: z.coerce.boolean(),
});

export const fieldDeleteSchema = z.object({
  projectId: uuid,
  fieldId: uuid,
});

export const columnHistorySchema = z.object({
  projectId: uuid,
  columnId: uuid,
  offset: z.coerce.number().int().min(0).default(0),
});

export const cardDetailSchema = z.object({
  projectId: uuid,
  cardId: uuid,
});

export const optionalDescription = optionalText;
