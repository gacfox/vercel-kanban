"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireProjectWrite } from "@/lib/services/permissions";
import {
  automationIdSchema,
  createAutomationSchema,
  toggleAutomationSchema,
  updateAutomationSchema,
} from "@/lib/validation/automation";
import type { ActionResult } from "@/lib/types";

type Condition = {
  type: string;
  columnIds?: string[];
  labelIds?: string[];
  userIds?: string[];
  fieldId?: string;
};

type Action = {
  type: string;
  columnId?: string;
  labelId?: string;
  userId?: string;
};

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

async function validateReferences(
  projectId: string,
  input: {
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    conditions: unknown[];
    actions: unknown[];
  }
): Promise<string | null> {
  const sql = await getDb();
  const [columnRows, labelRows, fieldRows, memberRows] = await Promise.all([
    sql`SELECT id FROM vk_columns WHERE project_id = ${projectId}` as unknown as Promise<Array<{ id: string }>>,
    sql`SELECT id FROM vk_labels WHERE project_id = ${projectId}` as unknown as Promise<Array<{ id: string }>>,
    sql`SELECT id FROM vk_custom_fields WHERE project_id = ${projectId}` as unknown as Promise<Array<{ id: string }>>,
    sql`SELECT user_id FROM vk_project_members WHERE project_id = ${projectId}` as unknown as Promise<Array<{ user_id: string }>>,
  ]);

  const columns = new Set(columnRows.map((row) => row.id));
  const labels = new Set(labelRows.map((row) => row.id));
  const fields = new Set(fieldRows.map((row) => row.id));
  const members = new Set(memberRows.map((row) => row.user_id));

  const config = input.triggerConfig;
  if (input.triggerType === "card.moved") {
    for (const key of ["fromColumnId", "toColumnId"]) {
      const value = config[key];
      if (typeof value === "string" && value && !columns.has(value)) {
        return "触发器引用的列不存在";
      }
    }
  }
  if (input.triggerType === "card.stale_in_column") {
    if (typeof config.columnId !== "string" || !columns.has(config.columnId)) {
      return "请选择有效的列";
    }
  }
  if (input.triggerType === "card.updated" && Array.isArray(config.customFieldIds)) {
    for (const id of config.customFieldIds) {
      if (typeof id !== "string" || !fields.has(id)) return "触发器引用的字段不存在";
    }
  }

  for (const raw of input.conditions as Condition[]) {
    if (raw.columnIds?.some((id) => !columns.has(id))) return "条件引用的列不存在";
    if (raw.labelIds?.some((id) => !labels.has(id))) return "条件引用的标签不存在";
    if (raw.userIds?.some((id) => !members.has(id))) return "条件引用的成员不存在";
    if (raw.fieldId && !fields.has(raw.fieldId)) return "条件引用的字段不存在";
  }

  for (const raw of input.actions as Action[]) {
    if (raw.columnId && !columns.has(raw.columnId)) return "动作引用的列不存在";
    if (raw.labelId && !labels.has(raw.labelId)) return "动作引用的标签不存在";
    if (raw.userId && !members.has(raw.userId)) return "动作引用的成员不存在";
  }

  return null;
}

export async function createAutomationAction(
  input: unknown
): Promise<ActionResult<{ automationId: string }>> {
  const parsed = createAutomationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("请检查规则配置", parsed.error.flatten().fieldErrors);
  }

  const access = await requireProjectWrite(parsed.data.projectId, "owner");
  if (!access.ok) return fail(access.error);

  const referenceError = await validateReferences(parsed.data.projectId, parsed.data);
  if (referenceError) return fail(referenceError);

  const automationId = randomUUID();
  const sql = await getDb();

  await sql`
    INSERT INTO vk_automations (
      id, project_id, name, enabled, trigger_type, trigger_config,
      conditions, actions, created_by
    )
    VALUES (
      ${automationId}, ${parsed.data.projectId}, ${parsed.data.name},
      ${parsed.data.enabled}, ${parsed.data.triggerType},
      ${JSON.stringify(parsed.data.triggerConfig)}::jsonb,
      ${JSON.stringify(parsed.data.conditions)}::jsonb,
      ${JSON.stringify(parsed.data.actions)}::jsonb,
      ${access.user.id}
    )
  `;

  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${parsed.data.projectId}`;
  revalidatePath(`/projects/${parsed.data.projectId}/settings`);
  return { ok: true, data: { automationId } };
}

export async function updateAutomationAction(
  input: unknown
): Promise<ActionResult> {
  const parsed = updateAutomationSchema.safeParse(input);
  if (!parsed.success) {
    return fail("请检查规则配置", parsed.error.flatten().fieldErrors);
  }

  const access = await requireProjectWrite(parsed.data.projectId, "owner");
  if (!access.ok) return fail(access.error);

  const referenceError = await validateReferences(parsed.data.projectId, parsed.data);
  if (referenceError) return fail(referenceError);

  const sql = await getDb();
  const rows = (await sql`
    UPDATE vk_automations
    SET name = ${parsed.data.name},
        enabled = ${parsed.data.enabled},
        trigger_type = ${parsed.data.triggerType},
        trigger_config = ${JSON.stringify(parsed.data.triggerConfig)}::jsonb,
        conditions = ${JSON.stringify(parsed.data.conditions)}::jsonb,
        actions = ${JSON.stringify(parsed.data.actions)}::jsonb
    WHERE id = ${parsed.data.automationId}
      AND project_id = ${parsed.data.projectId}
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  if (!rows[0]) return fail("规则不存在");

  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${parsed.data.projectId}`;
  revalidatePath(`/projects/${parsed.data.projectId}/settings`);
  return { ok: true, data: undefined };
}

export async function deleteAutomationAction(
  projectId: string,
  automationId: string
): Promise<ActionResult> {
  const parsed = automationIdSchema.safeParse({ projectId, automationId });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    DELETE FROM vk_automations
    WHERE id = ${automationId} AND project_id = ${projectId}
    RETURNING id
  `) as unknown as Array<{ id: string }>;
  if (!rows[0]) return fail("规则不存在");

  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true, data: undefined };
}

export async function toggleAutomationAction(
  projectId: string,
  automationId: string,
  enabled: boolean
): Promise<ActionResult> {
  const parsed = toggleAutomationSchema.safeParse({
    projectId,
    automationId,
    enabled,
  });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    UPDATE vk_automations
    SET enabled = ${enabled}
    WHERE id = ${automationId} AND project_id = ${projectId}
    RETURNING id
  `) as unknown as Array<{ id: string }>;
  if (!rows[0]) return fail("规则不存在");

  revalidatePath(`/projects/${projectId}/settings`);
  return { ok: true, data: undefined };
}
