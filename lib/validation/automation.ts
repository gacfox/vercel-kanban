import { z } from "zod";
import { PRIORITY_VALUES } from "@/lib/constants";

const uuid = z.string().uuid();

export const TRIGGER_TYPES = [
  "card.created",
  "card.moved",
  "card.updated",
  "card.due_soon",
  "card.overdue",
  "card.stale_in_column",
] as const;

export const UPDATED_FIELDS = [
  "due_at",
  "priority",
  "assignee",
  "labels",
  "custom_field",
] as const;

export const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("in_column"), columnIds: z.array(uuid).min(1) }),
  z.object({ type: z.literal("label_includes"), labelIds: z.array(uuid).min(1) }),
  z.object({ type: z.literal("label_excludes"), labelIds: z.array(uuid).min(1) }),
  z.object({
    type: z.literal("priority_in"),
    values: z.array(z.enum(PRIORITY_VALUES as [string, ...string[]])).min(1),
  }),
  z.object({ type: z.literal("assignee_in"), userIds: z.array(uuid).min(1) }),
  z.object({
    type: z.literal("title_contains"),
    text: z.string().trim().min(1).max(200),
  }),
  z.object({
    type: z.literal("due_within_days"),
    days: z.coerce.number().int().min(1).max(365),
  }),
  z.object({
    type: z.literal("field_equals"),
    fieldId: uuid,
    value: z.unknown(),
  }),
]);

export const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move_to_column"), columnId: uuid }),
  z.object({ type: z.literal("add_label"), labelId: uuid }),
  z.object({ type: z.literal("remove_label"), labelId: uuid }),
  z.object({
    type: z.literal("set_priority"),
    priority: z.enum(PRIORITY_VALUES as [string, ...string[]]),
  }),
  z.object({ type: z.literal("set_assignee"), userId: uuid }),
  z.object({ type: z.literal("clear_assignees") }),
  z.object({
    type: z.literal("set_due_at"),
    mode: z.literal("offset_days"),
    days: z.coerce.number().int().min(1).max(3650),
  }),
  z.object({ type: z.literal("clear_due_at") }),
  z.object({ type: z.literal("archive_card") }),
  z.object({
    type: z.literal("add_comment"),
    body: z.string().trim().min(1).max(2000),
  }),
]);

export const automationRuleSchema = z.object({
  projectId: uuid,
  name: z.string().trim().min(1, "请输入规则名称").max(100),
  enabled: z.boolean().default(true),
  triggerType: z.enum(TRIGGER_TYPES),
  triggerConfig: z.record(z.string(), z.unknown()).default({}),
  conditions: z.array(conditionSchema).max(10).default([]),
  actions: z.array(actionSchema).min(1).max(10),
});

export const createAutomationSchema = automationRuleSchema;

export const updateAutomationSchema = automationRuleSchema.extend({
  automationId: uuid,
});

export const automationIdSchema = z.object({
  projectId: uuid,
  automationId: uuid,
});

export const toggleAutomationSchema = z.object({
  projectId: uuid,
  automationId: uuid,
  enabled: z.boolean(),
});
