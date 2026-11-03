"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getProjectMembers } from "@/lib/db/queries/projects";
import { getCardDetail, getColumnHistory } from "@/lib/db/queries/board";
import { requireProjectRole, requireProjectWrite } from "@/lib/services/permissions";
import { runEventAutomations } from "@/lib/automation/engine";
import { BOARD_HISTORY_PAGE_SIZE, SORT_STEP } from "@/lib/constants";
import {
  cardArchiveSchema,
  cardCreateSchema,
  cardDeleteSchema,
  cardDetailSchema,
  cardMoveSchema,
  cardUpdateSchema,
  columnCreateSchema,
  columnDeleteSchema,
  columnHistorySchema,
  columnReorderSchema,
  columnUpdateSchema,
  commentCreateSchema,
  commentDeleteSchema,
  commentUpdateSchema,
  fieldCreateSchema,
  fieldDeleteSchema,
  fieldUpdateSchema,
  labelCreateSchema,
  labelDeleteSchema,
  labelUpdateSchema,
} from "@/lib/validation/board";
import type { ActionResult, FieldType } from "@/lib/types";

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function formToObject(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

function revalidateBoard(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/archive`);
  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath("/projects");
}

function touchProjectQuery(sql: Awaited<ReturnType<typeof getDb>>, projectId: string) {
  return sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
}

async function ensureColumnInProject(
  sql: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  columnId: string
) {
  const rows = (await sql`
    SELECT id, title, position, wip_limit FROM vk_columns
    WHERE id = ${columnId} AND project_id = ${projectId}
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    title: string;
    position: number;
    wip_limit: number | null;
  }>;
  return rows[0] ?? null;
}

async function ensureCardInProject(
  sql: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  cardId: string
) {
  const rows = (await sql`
    SELECT id, column_id, title, archived_at FROM vk_cards
    WHERE id = ${cardId} AND project_id = ${projectId}
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    column_id: string | null;
    title: string;
    archived_at: string | Date | null;
  }>;
  return rows[0] ?? null;
}

async function validateLabels(
  sql: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  labelIds: string[]
) {
  if (labelIds.length === 0) return true;
  const rows = (await sql.query(
    "SELECT id FROM vk_labels WHERE project_id = $1 AND id = ANY($2::uuid[])",
    [projectId, labelIds]
  )) as unknown as Array<{ id: string }>;
  return rows.length === labelIds.length;
}

async function validateAssignees(
  sql: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  assigneeIds: string[]
) {
  if (assigneeIds.length === 0) return true;
  const members = await getProjectMembers(projectId);
  const allowed = new Set(members.map((member) => member.user.id));
  return assigneeIds.every((id) => allowed.has(id));
}

type FieldDef = {
  id: string;
  type: FieldType;
  options: string[];
  name: string;
};

async function loadFieldDefs(
  sql: Awaited<ReturnType<typeof getDb>>,
  projectId: string
): Promise<FieldDef[]> {
  const rows = (await sql`
    SELECT id, type, options, name FROM vk_custom_fields WHERE project_id = ${projectId}
  `) as unknown as Array<{
    id: string;
    type: FieldType;
    options: unknown;
    name: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    name: row.name,
  }));
}

function isValidFieldValue(field: FieldDef, value: unknown): boolean {
  if (value == null) return true;
  switch (field.type) {
    case "text":
    case "long_text":
      return typeof value === "string" && value.length <= 20000;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    case "select":
      return typeof value === "string" && field.options.includes(value);
    case "multi_select":
      return (
        Array.isArray(value) &&
        value.every((item) => typeof item === "string" && field.options.includes(item))
      );
    case "checkbox":
      return typeof value === "boolean";
    case "url": {
      if (typeof value !== "string" || value.length === 0) return false;
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }
    case "user":
      return typeof value === "string";
    default:
      return false;
  }
}

function normalizeDueAt(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isEmptyFieldValue(value: unknown): boolean {
  return (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export async function createColumnAction(
  _prevState: ActionResult<{ columnId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ columnId: string }>> {
  const parsed = columnCreateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, title, wipLimit, historyWindowDays, isDone } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    SELECT COALESCE(MAX(position), 0) + ${SORT_STEP} AS next_position
    FROM vk_columns WHERE project_id = ${projectId}
  `) as unknown as Array<{ next_position: number }>;

  const full = (await sql`
    INSERT INTO vk_columns (
      project_id, title, position, wip_limit, history_window_days, is_done
    )
    VALUES (
      ${projectId}, ${title}, ${Number(rows[0]?.next_position ?? SORT_STEP)},
      ${wipLimit ?? null}, ${historyWindowDays ?? null}, ${Boolean(isDone)}
    )
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  const columnId = full[0]?.id;
  if (!columnId) return fail("创建列失败");

  await sql.transaction([
    sql`
      INSERT INTO vk_activities (project_id, user_id, type, data)
      VALUES (
        ${projectId}, ${access.user.id}, 'column.created',
        ${JSON.stringify({ title })}::jsonb
      )
    `,
    touchProjectQuery(sql, projectId),
  ]);

  revalidateBoard(projectId);
  return { ok: true, data: { columnId } };
}

export async function updateColumnAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = columnUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const {
    projectId,
    columnId,
    title,
    wipLimit,
    historyWindowDays,
    isDone,
  } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const column = await ensureColumnInProject(sql, projectId, columnId);
  if (!column) return fail("列不存在");

  await sql.transaction([
    sql`
      UPDATE vk_columns
      SET title = ${title},
          wip_limit = ${wipLimit ?? null},
          history_window_days = ${historyWindowDays ?? null},
          is_done = ${Boolean(isDone)}
      WHERE id = ${columnId} AND project_id = ${projectId}
    `,
    sql`
      INSERT INTO vk_activities (project_id, user_id, type, data)
      VALUES (
        ${projectId}, ${access.user.id}, 'column.updated',
        ${JSON.stringify({ title })}::jsonb
      )
    `,
    touchProjectQuery(sql, projectId),
  ]);

  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function deleteColumnAction(
  projectId: string,
  columnId: string,
  strategy: "move" | "archive",
  targetColumnId?: string | null
): Promise<ActionResult> {
  const parsed = columnDeleteSchema.safeParse({
    projectId,
    columnId,
    strategy,
    targetColumnId: targetColumnId ?? null,
  });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const column = await ensureColumnInProject(sql, projectId, columnId);
  if (!column) return fail("列不存在");

  const countRows = (await sql`
    SELECT count(*)::int AS count FROM vk_columns WHERE project_id = ${projectId}
  `) as unknown as Array<{ count: number }>;
  if (Number(countRows[0]?.count ?? 0) <= 1) {
    return fail("项目至少保留一列");
  }

  if (strategy === "move") {
    if (!targetColumnId || targetColumnId === columnId) {
      return fail("请选择要移动到哪一列");
    }
    const target = await ensureColumnInProject(sql, projectId, targetColumnId);
    if (!target) return fail("目标列不存在");
  }

  const cardCountRows = (await sql`
    SELECT count(*)::int AS count FROM vk_cards
    WHERE column_id = ${columnId} AND archived_at IS NULL
  `) as unknown as Array<{ count: number }>;
  const cardCount = Number(cardCountRows[0]?.count ?? 0);

  const queries: Array<ReturnType<typeof sql>> = [];

  if (strategy === "move" && targetColumnId) {
    queries.push(sql`
      UPDATE vk_cards SET column_id = ${targetColumnId} WHERE column_id = ${columnId}
    `);
  } else {
    queries.push(sql`
      UPDATE vk_cards
      SET archived_at = now()
      WHERE column_id = ${columnId} AND archived_at IS NULL
    `);
  }

  queries.push(sql`DELETE FROM vk_columns WHERE id = ${columnId} AND project_id = ${projectId}`);
  queries.push(sql`
    INSERT INTO vk_activities (project_id, user_id, type, data)
    VALUES (
      ${projectId}, ${access.user.id}, 'column.deleted',
      ${JSON.stringify({ title: column.title, strategy, cardCount })}::jsonb
    )
  `);
  queries.push(touchProjectQuery(sql, projectId));

  await sql.transaction(queries);
  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function reorderColumnAction(
  projectId: string,
  columnId: string,
  beforeColumnId?: string | null,
  afterColumnId?: string | null
): Promise<ActionResult> {
  const parsed = columnReorderSchema.safeParse({
    projectId,
    columnId,
    beforeColumnId: beforeColumnId ?? null,
    afterColumnId: afterColumnId ?? null,
  });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    SELECT id FROM vk_columns
    WHERE project_id = ${projectId}
    ORDER BY position ASC, created_at ASC, id ASC
  `) as unknown as Array<{ id: string }>;

  const ids = rows.map((row) => row.id);
  if (!ids.includes(columnId)) return fail("列不存在");

  const without = ids.filter((id) => id !== columnId);
  let index = without.length;

  if (beforeColumnId) {
    const beforeIndex = without.indexOf(beforeColumnId);
    if (beforeIndex >= 0) index = beforeIndex;
  } else if (afterColumnId) {
    const afterIndex = without.indexOf(afterColumnId);
    if (afterIndex >= 0) index = afterIndex + 1;
  }

  without.splice(Math.max(0, Math.min(index, without.length)), 0, columnId);

  const queries = without.map(
    (id, idx) => sql`UPDATE vk_columns SET position = ${(idx + 1) * SORT_STEP} WHERE id = ${id}`
  );
  queries.push(sql`
    INSERT INTO vk_activities (project_id, user_id, type, data)
    VALUES (${projectId}, ${access.user.id}, 'column.reordered', '{}'::jsonb)
  `);
  queries.push(touchProjectQuery(sql, projectId));

  await sql.transaction(queries);
  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function createCardAction(
  _prevState: ActionResult<{ cardId: string; automationApplied: boolean }> | null,
  formData: FormData
): Promise<ActionResult<{ cardId: string; automationApplied: boolean }>> {
  const parsed = cardCreateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, columnId, title, description, priority, dueAt } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const column = await ensureColumnInProject(sql, projectId, columnId);
  if (!column) return fail("列不存在");

  const countRows = (await sql`
    SELECT count(*)::int AS count FROM vk_cards
    WHERE column_id = ${columnId} AND archived_at IS NULL
  `) as unknown as Array<{ count: number }>;

  if (column.wip_limit != null && Number(countRows[0]?.count ?? 0) >= column.wip_limit) {
    return fail("该列已达到 WIP 上限");
  }

  const normalizedDue = normalizeDueAt(dueAt);
  if (dueAt !== undefined && dueAt !== null && dueAt !== "" && normalizedDue === undefined) {
    return fail("截止时间不合法");
  }

  const positionRows = (await sql`
    SELECT COALESCE(MAX(position), 0) + ${SORT_STEP} AS next_position
    FROM vk_cards WHERE column_id = ${columnId} AND archived_at IS NULL
  `) as unknown as Array<{ next_position: number }>;

  const inserted = (await sql`
    INSERT INTO vk_cards (
      project_id, column_id, title, description, position, priority, due_at, created_by
    )
    VALUES (
      ${projectId}, ${columnId}, ${title}, ${description},
      ${Number(positionRows[0]?.next_position ?? SORT_STEP)},
      ${priority}, ${normalizedDue ?? null}, ${access.user.id}
    )
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  const cardId = inserted[0]?.id;
  if (!cardId) return fail("创建卡片失败");

  await sql.transaction([
    sql`
      INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
      VALUES (
        ${projectId}, ${cardId}, ${access.user.id}, 'card.created',
        ${JSON.stringify({ title, column: column.title })}::jsonb
      )
    `,
    touchProjectQuery(sql, projectId),
  ]);

  const automationApplied = await runEventAutomations({
    projectId,
    cardId,
    triggerType: "card.created",
    actorId: access.user.id,
    depth: 0,
    ranRuleIds: new Set<string>(),
  });

  revalidateBoard(projectId);
  return { ok: true, data: { cardId, automationApplied } };
}

export async function updateCardAction(
  input: unknown
): Promise<ActionResult<{ automationApplied: boolean }>> {
  const parsed = cardUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法", parsed.error.flatten().fieldErrors);

  const {
    projectId,
    cardId,
    title,
    description,
    priority,
    dueAt,
    labelIds,
    assigneeIds,
    fieldValues,
  } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const card = await ensureCardInProject(sql, projectId, cardId);
  if (!card) return fail("卡片不存在");
  if (card.archived_at) return fail("卡片已归档");

  if (labelIds && !(await validateLabels(sql, projectId, labelIds))) {
    return fail("标签不存在或不属于该项目");
  }
  if (assigneeIds && !(await validateAssignees(sql, projectId, assigneeIds))) {
    return fail("负责人必须是项目成员");
  }

  if (fieldValues) {
    const fieldDefs = await loadFieldDefs(sql, projectId);
    const byId = new Map(fieldDefs.map((field) => [field.id, field]));
    const members = new Set(
      (await getProjectMembers(projectId)).map((member) => member.user.id)
    );

    for (const [fieldId, value] of Object.entries(fieldValues)) {
      const field = byId.get(fieldId);
      if (!field) return fail("自定义字段不存在或不属于该项目");
      if (isEmptyFieldValue(value)) continue;
      if (!isValidFieldValue(field, value)) {
        return fail(`字段「${field.name}」的值不合法`);
      }
      if (field.type === "user" && (typeof value !== "string" || !members.has(value))) {
        return fail(`字段「${field.name}」必须选择项目成员`);
      }
    }
  }

  const normalizedDue = normalizeDueAt(dueAt);
  if (dueAt !== undefined && dueAt !== null && dueAt !== "" && normalizedDue === undefined) {
    return fail("截止时间不合法");
  }

  const queries: Array<ReturnType<typeof sql>> = [];
  const changed: string[] = [];

  if (title !== undefined) {
    queries.push(sql`UPDATE vk_cards SET title = ${title} WHERE id = ${cardId}`);
    changed.push("title");
  }
  if (description !== undefined) {
    queries.push(sql`UPDATE vk_cards SET description = ${description} WHERE id = ${cardId}`);
    changed.push("description");
  }
  if (priority !== undefined) {
    queries.push(sql`UPDATE vk_cards SET priority = ${priority} WHERE id = ${cardId}`);
    changed.push("priority");
  }
  if (dueAt !== undefined) {
    queries.push(sql`UPDATE vk_cards SET due_at = ${normalizedDue ?? null} WHERE id = ${cardId}`);
    changed.push("dueAt");
  }

  if (labelIds !== undefined) {
    queries.push(sql`DELETE FROM vk_card_labels WHERE card_id = ${cardId}`);
    for (const labelId of labelIds) {
      queries.push(sql`
        INSERT INTO vk_card_labels (card_id, label_id)
        VALUES (${cardId}, ${labelId})
        ON CONFLICT DO NOTHING
      `);
    }
    changed.push("labels");
  }

  if (assigneeIds !== undefined) {
    queries.push(sql`DELETE FROM vk_card_assignees WHERE card_id = ${cardId}`);
    for (const userId of assigneeIds) {
      queries.push(sql`
        INSERT INTO vk_card_assignees (card_id, user_id)
        VALUES (${cardId}, ${userId})
        ON CONFLICT DO NOTHING
      `);
    }
    changed.push("assignees");
  }

  if (fieldValues) {
    for (const [fieldId, value] of Object.entries(fieldValues)) {
      if (isEmptyFieldValue(value)) {
        queries.push(sql`
          DELETE FROM vk_card_field_values
          WHERE card_id = ${cardId} AND field_id = ${fieldId}
        `);
      } else {
        queries.push(sql`
          INSERT INTO vk_card_field_values (card_id, field_id, value)
          VALUES (${cardId}, ${fieldId}, ${JSON.stringify(value)}::jsonb)
          ON CONFLICT (card_id, field_id)
          DO UPDATE SET value = EXCLUDED.value
        `);
      }
    }
    changed.push("fields");
  }

  queries.push(sql`
    INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
    VALUES (
      ${projectId}, ${cardId}, ${access.user.id}, 'card.updated',
      ${JSON.stringify({ cardTitle: card.title, fields: changed })}::jsonb
    )
  `);
  queries.push(touchProjectQuery(sql, projectId));

  await sql.transaction(queries);

  const changedFields = changed.flatMap((field) => {
    if (field === "priority") return ["priority"];
    if (field === "dueAt") return ["due_at"];
    if (field === "labels") return ["labels"];
    if (field === "assignees") return ["assignee"];
    if (field === "fields") return ["custom_field"];
    return [];
  });

  const automationApplied =
    changedFields.length > 0
      ? await runEventAutomations({
          projectId,
          cardId,
          triggerType: "card.updated",
          actorId: access.user.id,
          event: {
            changedFields,
            changedCustomFieldIds: fieldValues ? Object.keys(fieldValues) : [],
          },
          depth: 0,
          ranRuleIds: new Set<string>(),
        })
      : false;

  revalidateBoard(projectId);
  return { ok: true, data: { automationApplied } };
}

export async function moveCardAction(input: unknown): Promise<ActionResult<{ automationApplied: boolean }>> {
  const parsed = cardMoveSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const {
    projectId,
    cardId,
    targetColumnId,
    beforeCardId,
    afterCardId,
    targetIndex,
  } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const card = await ensureCardInProject(sql, projectId, cardId);
  if (!card) return fail("卡片不存在");
  if (card.archived_at) return fail("卡片已归档");

  const targetColumn = await ensureColumnInProject(sql, projectId, targetColumnId);
  if (!targetColumn) return fail("目标列不存在");

  const sourceColumn = card.column_id
    ? await ensureColumnInProject(sql, projectId, card.column_id)
    : null;

  if (targetColumnId !== card.column_id && targetColumn.wip_limit != null) {
    const countRows = (await sql`
      SELECT count(*)::int AS count FROM vk_cards
      WHERE column_id = ${targetColumnId}
        AND archived_at IS NULL
        AND id <> ${cardId}
    `) as unknown as Array<{ count: number }>;

    if (Number(countRows[0]?.count ?? 0) >= targetColumn.wip_limit) {
      return fail("目标列已达到 WIP 上限");
    }
  }

  const rows = (await sql`
    SELECT id FROM vk_cards
    WHERE column_id = ${targetColumnId}
      AND archived_at IS NULL
      AND id <> ${cardId}
    ORDER BY position ASC, created_at ASC, id ASC
  `) as unknown as Array<{ id: string }>;

  const ids = rows.map((row) => row.id);
  let index = ids.length;

  if (beforeCardId) {
    const beforeIndex = ids.indexOf(beforeCardId);
    if (beforeIndex >= 0) index = beforeIndex;
  } else if (afterCardId) {
    const afterIndex = ids.indexOf(afterCardId);
    if (afterIndex >= 0) index = afterIndex + 1;
  } else if (targetIndex !== undefined) {
    index = targetIndex;
  }

  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, cardId);

  const queries: Array<ReturnType<typeof sql>> = [
    sql`UPDATE vk_cards SET column_id = ${targetColumnId} WHERE id = ${cardId}`,
    ...ids.map(
      (id, idx) => sql`UPDATE vk_cards SET position = ${(idx + 1) * SORT_STEP} WHERE id = ${id}`
    ),
  ];

  const columnChanged = card.column_id !== targetColumnId;
  queries.push(sql`
    INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
    VALUES (
      ${projectId}, ${cardId}, ${access.user.id},
      ${columnChanged ? "card.moved" : "card.updated"},
      ${JSON.stringify({
        cardTitle: card.title,
        fromColumn: sourceColumn?.title ?? null,
        toColumn: targetColumn.title,
        reordered: !columnChanged,
      })}::jsonb
    )
  `);
  queries.push(touchProjectQuery(sql, projectId));

  await sql.transaction(queries);

  const automationApplied = columnChanged
    ? await runEventAutomations({
        projectId,
        cardId,
        triggerType: "card.moved",
        actorId: access.user.id,
        event: {
          fromColumnId: card.column_id,
          toColumnId: targetColumnId,
        },
        depth: 0,
        ranRuleIds: new Set<string>(),
      })
    : false;

  revalidateBoard(projectId);
  return { ok: true, data: { automationApplied } };
}

export async function archiveCardAction(input: unknown): Promise<ActionResult> {
  const parsed = cardArchiveSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const { projectId, cardId, archived } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const card = await ensureCardInProject(sql, projectId, cardId);
  if (!card) return fail("卡片不存在");

  let columnId = card.column_id;
  if (!archived) {
    if (columnId) {
      const column = await ensureColumnInProject(sql, projectId, columnId);
      if (!column) columnId = null;
    }
    if (!columnId) {
      const first = (await sql`
        SELECT id FROM vk_columns WHERE project_id = ${projectId}
        ORDER BY position ASC, created_at ASC, id ASC LIMIT 1
      `) as unknown as Array<{ id: string }>;
      columnId = first[0]?.id ?? null;
    }
    if (!columnId) return fail("项目还没有列，无法恢复卡片");
  }

  await sql.transaction([
    sql`
      UPDATE vk_cards
      SET archived_at = ${archived ? new Date().toISOString() : null},
          column_id = ${columnId}
      WHERE id = ${cardId}
    `,
    sql`
      INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
      VALUES (
        ${projectId}, ${cardId}, ${access.user.id},
        ${archived ? "card.archived" : "card.restored"},
        ${JSON.stringify({ cardTitle: card.title })}::jsonb
      )
    `,
    touchProjectQuery(sql, projectId),
  ]);

  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function deleteCardAction(input: unknown): Promise<ActionResult> {
  const parsed = cardDeleteSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const { projectId, cardId } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const card = await ensureCardInProject(sql, projectId, cardId);
  if (!card) return fail("卡片不存在");
  if (!card.archived_at) return fail("请先归档卡片再彻底删除");

  await sql.transaction([
    sql`
      INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
      VALUES (
        ${projectId}, NULL, ${access.user.id}, 'card.deleted',
        ${JSON.stringify({ cardTitle: card.title })}::jsonb
      )
    `,
    sql`DELETE FROM vk_cards WHERE id = ${cardId} AND project_id = ${projectId}`,
    touchProjectQuery(sql, projectId),
  ]);

  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function loadCardDetailAction(
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof getCardDetail>>>> {
  const parsed = cardDetailSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectRole(parsed.data.projectId, "viewer");
  if (!access.ok) return fail(access.error);

  const detail = await getCardDetail(parsed.data.projectId, parsed.data.cardId);
  if (!detail) return fail("卡片不存在");
  return { ok: true, data: detail };
}

export async function loadColumnHistoryAction(
  input: unknown
): Promise<ActionResult<Awaited<ReturnType<typeof getColumnHistory>>>> {
  const parsed = columnHistorySchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectRole(parsed.data.projectId, "viewer");
  if (!access.ok) return fail(access.error);

  const history = await getColumnHistory(
    parsed.data.projectId,
    parsed.data.columnId,
    parsed.data.offset,
    BOARD_HISTORY_PAGE_SIZE
  );

  return { ok: true, data: history };
}


export async function createLabelAction(
  _prevState: ActionResult<{ labelId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ labelId: string }>> {
  const parsed = labelCreateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, name, color } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const positionRows = (await sql`
    SELECT COALESCE(MAX(position), 0) + ${SORT_STEP} AS next_position
    FROM vk_labels WHERE project_id = ${projectId}
  `) as unknown as Array<{ next_position: number }>;

  try {
    const rows = (await sql`
      INSERT INTO vk_labels (project_id, name, color, position)
      VALUES (${projectId}, ${name}, ${color}, ${Number(positionRows[0]?.next_position ?? SORT_STEP)})
      RETURNING id
    `) as unknown as Array<{ id: string }>;

    const labelId = rows[0]?.id;
    if (!labelId) return fail("创建标签失败");

    await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
    revalidateBoard(projectId);
    return { ok: true, data: { labelId } };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return fail("标签名称已存在");
    throw error;
  }
}

export async function updateLabelAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = labelUpdateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, labelId, name, color } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  try {
    const rows = (await sql`
      UPDATE vk_labels SET name = ${name}, color = ${color}
      WHERE id = ${labelId} AND project_id = ${projectId}
      RETURNING id
    `) as unknown as Array<{ id: string }>;
    if (!rows[0]) return fail("标签不存在");
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return fail("标签名称已存在");
    throw error;
  }

  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function deleteLabelAction(
  projectId: string,
  labelId: string
): Promise<ActionResult> {
  const parsed = labelDeleteSchema.safeParse({ projectId, labelId });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    DELETE FROM vk_labels WHERE id = ${labelId} AND project_id = ${projectId}
    RETURNING id
  `) as unknown as Array<{ id: string }>;
  if (!rows[0]) return fail("标签不存在");

  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function createFieldAction(
  _prevState: ActionResult<{ fieldId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ fieldId: string }>> {
  const raw = formToObject(formData);
  const optionsRaw = typeof raw.options === "string" ? raw.options : "";
  const parsed = fieldCreateSchema.safeParse({
    ...raw,
    options: optionsRaw
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, name, type, options, showOnCard } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const positionRows = (await sql`
    SELECT COALESCE(MAX(position), 0) + ${SORT_STEP} AS next_position
    FROM vk_custom_fields WHERE project_id = ${projectId}
  `) as unknown as Array<{ next_position: number }>;

  try {
    const rows = (await sql`
      INSERT INTO vk_custom_fields (
        project_id, name, type, options, position, show_on_card
      )
      VALUES (
        ${projectId}, ${name}, ${type},
        ${JSON.stringify(options)}::jsonb,
        ${Number(positionRows[0]?.next_position ?? SORT_STEP)},
        ${Boolean(showOnCard)}
      )
      RETURNING id
    `) as unknown as Array<{ id: string }>;

    const fieldId = rows[0]?.id;
    if (!fieldId) return fail("创建字段失败");

    await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
    revalidateBoard(projectId);
    return { ok: true, data: { fieldId } };
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return fail("字段名称已存在");
    throw error;
  }
}

export async function updateFieldAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const raw = formToObject(formData);
  const optionsRaw = typeof raw.options === "string" ? raw.options : "";
  const parsed = fieldUpdateSchema.safeParse({
    ...raw,
    options: optionsRaw
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean),
  });
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, fieldId, name, options, showOnCard } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  try {
    const rows = (await sql`
      UPDATE vk_custom_fields
      SET name = ${name},
          options = ${JSON.stringify(options)}::jsonb,
          show_on_card = ${Boolean(showOnCard)}
      WHERE id = ${fieldId} AND project_id = ${projectId}
      RETURNING id
    `) as unknown as Array<{ id: string }>;
    if (!rows[0]) return fail("字段不存在");
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return fail("字段名称已存在");
    throw error;
  }

  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function deleteFieldAction(
  projectId: string,
  fieldId: string
): Promise<ActionResult> {
  const parsed = fieldDeleteSchema.safeParse({ projectId, fieldId });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    DELETE FROM vk_custom_fields
    WHERE id = ${fieldId} AND project_id = ${projectId}
    RETURNING id
  `) as unknown as Array<{ id: string }>;
  if (!rows[0]) return fail("字段不存在");

  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function createCommentAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = commentCreateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, cardId, body } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const card = await ensureCardInProject(sql, projectId, cardId);
  if (!card) return fail("卡片不存在");

  await sql.transaction([
    sql`
      INSERT INTO vk_comments (card_id, user_id, body)
      VALUES (${cardId}, ${access.user.id}, ${body})
    `,
    sql`
      INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
      VALUES (
        ${projectId}, ${cardId}, ${access.user.id}, 'comment.created',
        ${JSON.stringify({ cardTitle: card.title })}::jsonb
      )
    `,
    sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`,
  ]);

  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

async function getCommentForAction(
  sql: Awaited<ReturnType<typeof getDb>>,
  projectId: string,
  commentId: string
) {
  const rows = (await sql`
    SELECT cm.id, cm.user_id, cm.card_id, c.title AS card_title
    FROM vk_comments cm
    JOIN vk_cards c ON c.id = cm.card_id
    WHERE cm.id = ${commentId}
      AND c.project_id = ${projectId}
      AND cm.deleted_at IS NULL
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    user_id: string | null;
    card_id: string;
    card_title: string;
  }>;
  return rows[0] ?? null;
}

export async function updateCommentAction(input: unknown): Promise<ActionResult> {
  const parsed = commentUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const { projectId, commentId, body } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const comment = await getCommentForAction(sql, projectId, commentId);
  if (!comment) return fail("评论不存在");
  if (comment.user_id !== access.user.id) return fail("只能编辑自己的评论");

  await sql.transaction([
    sql`UPDATE vk_comments SET body = ${body} WHERE id = ${commentId}`,
    sql`
      INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
      VALUES (
        ${projectId}, ${comment.card_id}, ${access.user.id}, 'comment.updated',
        ${JSON.stringify({ cardTitle: comment.card_title })}::jsonb
      )
    `,
    sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`,
  ]);

  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}

export async function deleteCommentAction(input: unknown): Promise<ActionResult> {
  const parsed = commentDeleteSchema.safeParse(input);
  if (!parsed.success) return fail("参数不合法");

  const { projectId, commentId } = parsed.data;
  const access = await requireProjectWrite(projectId, "editor");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const comment = await getCommentForAction(sql, projectId, commentId);
  if (!comment) return fail("评论不存在");

  const canDelete =
    comment.user_id === access.user.id ||
    access.access.role === "owner" ||
    access.access.isAdmin;
  if (!canDelete) return fail("只能删除自己的评论");

  await sql.transaction([
    sql`UPDATE vk_comments SET deleted_at = now() WHERE id = ${commentId}`,
    sql`
      INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
      VALUES (
        ${projectId}, ${comment.card_id}, ${access.user.id}, 'comment.deleted',
        ${JSON.stringify({ cardTitle: comment.card_title })}::jsonb
      )
    `,
    sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`,
  ]);

  revalidateBoard(projectId);
  return { ok: true, data: undefined };
}
