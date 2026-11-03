import "server-only";
import { getDb } from "@/lib/db";
import { parseJson, toISO, toInt } from "@/lib/db/serialize";
import type { Priority } from "@/lib/types";

export type Automation = {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: unknown[];
  actions: unknown[];
  createdAt: string;
  updatedAt: string;
};

export type AutomationRun = {
  id: number;
  automationId: string;
  automationName: string | null;
  cardId: string | null;
  cardTitle: string | null;
  status: "success" | "skipped" | "error";
  message: string;
  createdAt: string;
};

export type AutomationCard = {
  id: string;
  projectId: string;
  columnId: string | null;
  columnTitle: string | null;
  isDone: boolean;
  title: string;
  priority: Priority;
  dueAt: string | null;
  columnEnteredAt: string;
  archivedAt: string | null;
  labels: Array<{ id: string; name: string }>;
  assignees: string[];
  fieldValues: Record<string, unknown>;
};

type AutomationRow = {
  id: string;
  project_id: string;
  name: string;
  enabled: boolean;
  trigger_type: string;
  trigger_config: unknown;
  conditions: unknown;
  actions: unknown;
  created_at: string | Date;
  updated_at: string | Date;
};

type RunRow = {
  id: string | number;
  automation_id: string;
  automation_name: string | null;
  card_id: string | null;
  card_title: string | null;
  status: "success" | "skipped" | "error";
  message: string;
  created_at: string | Date;
};

export async function getAutomations(projectId: string): Promise<Automation[]> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT id, project_id, name, enabled, trigger_type, trigger_config,
           conditions, actions, created_at, updated_at
    FROM vk_automations
    WHERE project_id = ${projectId}
    ORDER BY created_at ASC
  `) as unknown as AutomationRow[];

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    enabled: row.enabled,
    triggerType: row.trigger_type,
    triggerConfig: parseJson<Record<string, unknown>>(row.trigger_config, {}),
    conditions: parseJson<unknown[]>(row.conditions, []),
    actions: parseJson<unknown[]>(row.actions, []),
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toISO(row.updated_at) ?? new Date(0).toISOString(),
  }));
}

export async function getAutomationRuns(
  projectId: string,
  limit = 50
): Promise<AutomationRun[]> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT r.id, r.automation_id, a.name AS automation_name, r.card_id,
           c.title AS card_title, r.status, r.message, r.created_at
    FROM vk_automation_runs r
    LEFT JOIN vk_automations a ON a.id = r.automation_id
    LEFT JOIN vk_cards c ON c.id = r.card_id
    WHERE r.project_id = ${projectId}
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `) as unknown as RunRow[];

  return rows.map((row) => ({
    id: Number(row.id),
    automationId: row.automation_id,
    automationName: row.automation_name,
    cardId: row.card_id,
    cardTitle: row.card_title,
    status: row.status,
    message: row.message,
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
  }));
}

export async function getAutomationCard(
  projectId: string,
  cardId: string
): Promise<AutomationCard | null> {
  const sql = await getDb();

  const cardRows = (await sql`
    SELECT c.id, c.project_id, c.column_id, c.title, c.priority, c.due_at,
           c.column_entered_at, c.archived_at,
           col.title AS column_title, COALESCE(col.is_done, false) AS is_done
    FROM vk_cards c
    LEFT JOIN vk_columns col ON col.id = c.column_id
    WHERE c.project_id = ${projectId} AND c.id = ${cardId}
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    project_id: string;
    column_id: string | null;
    title: string;
    priority: Priority;
    due_at: string | Date | null;
    column_entered_at: string | Date;
    archived_at: string | Date | null;
    column_title: string | null;
    is_done: boolean;
  }>;

  const card = cardRows[0];
  if (!card) return null;

  const [labelRows, assigneeRows, fieldRows] = await Promise.all([
    sql`
      SELECT l.id, l.name FROM vk_card_labels cl
      JOIN vk_labels l ON l.id = cl.label_id
      WHERE cl.card_id = ${cardId}
    ` as unknown as Promise<Array<{ id: string; name: string }>>,
    sql`
      SELECT user_id FROM vk_card_assignees WHERE card_id = ${cardId}
    ` as unknown as Promise<Array<{ user_id: string }>>,
    sql`
      SELECT field_id, value FROM vk_card_field_values WHERE card_id = ${cardId}
    ` as unknown as Promise<Array<{ field_id: string; value: unknown }>>,
  ]);

  return {
    id: card.id,
    projectId: card.project_id,
    columnId: card.column_id,
    columnTitle: card.column_title,
    isDone: card.is_done,
    title: card.title,
    priority: card.priority,
    dueAt: toISO(card.due_at),
    columnEnteredAt: toISO(card.column_entered_at) ?? new Date(0).toISOString(),
    archivedAt: toISO(card.archived_at),
    labels: labelRows.map((row) => ({ id: row.id, name: row.name })),
    assignees: assigneeRows.map((row) => row.user_id),
    fieldValues: Object.fromEntries(
      fieldRows.map((row) => [row.field_id, parseJson<unknown>(row.value, null)])
    ),
  };
}

export async function getEnabledAutomationsByTrigger(
  triggerType: string
): Promise<Automation[]> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT id, project_id, name, enabled, trigger_type, trigger_config,
           conditions, actions, created_at, updated_at
    FROM vk_automations
    WHERE enabled = true AND trigger_type = ${triggerType}
    ORDER BY created_at ASC
  `) as unknown as AutomationRow[];

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    enabled: row.enabled,
    triggerType: row.trigger_type,
    triggerConfig: parseJson<Record<string, unknown>>(row.trigger_config, {}),
    conditions: parseJson<unknown[]>(row.conditions, []),
    actions: parseJson<unknown[]>(row.actions, []),
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toISO(row.updated_at) ?? new Date(0).toISOString(),
  }));
}

export async function getProjectAutomationsByTrigger(
  projectId: string,
  triggerType: string
): Promise<Automation[]> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT id, project_id, name, enabled, trigger_type, trigger_config,
           conditions, actions, created_at, updated_at
    FROM vk_automations
    WHERE project_id = ${projectId}
      AND enabled = true
      AND trigger_type = ${triggerType}
    ORDER BY created_at ASC
  `) as unknown as AutomationRow[];

  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    enabled: row.enabled,
    triggerType: row.trigger_type,
    triggerConfig: parseJson<Record<string, unknown>>(row.trigger_config, {}),
    conditions: parseJson<unknown[]>(row.conditions, []),
    actions: parseJson<unknown[]>(row.actions, []),
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toISO(row.updated_at) ?? new Date(0).toISOString(),
  }));
}

export async function getAutomationRunCount(projectId: string): Promise<number> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT count(*)::int AS count FROM vk_automation_runs WHERE project_id = ${projectId}
  `) as unknown as Array<{ count: number }>;
  return toInt(rows[0]?.count);
}
