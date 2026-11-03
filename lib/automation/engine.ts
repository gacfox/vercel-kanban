import "server-only";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import {
  getAutomationCard,
  getEnabledAutomationsByTrigger,
  getProjectAutomationsByTrigger,
  type Automation,
  type AutomationCard,
} from "@/lib/db/queries/automations";
import type { actionSchema, conditionSchema } from "@/lib/validation/automation";
import type { z } from "zod";

type Condition = z.infer<typeof conditionSchema>;
type Action = z.infer<typeof actionSchema>;

export type AutomationEvent = {
  fromColumnId?: string | null;
  toColumnId?: string | null;
  changedFields?: string[];
  changedCustomFieldIds?: string[];
};

type RunContext = {
  triggerType: string;
  actorId: string | null;
  event?: AutomationEvent;
  depth: number;
  ranRuleIds: Set<string>;
};

function asConditions(value: unknown[]): Condition[] {
  return value as Condition[];
}

function asActions(value: unknown[]): Action[] {
  return value as Action[];
}

function includesString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function matchesTrigger(rule: Automation, context: RunContext): boolean {
  const config = rule.triggerConfig;
  if (rule.triggerType === "card.created") return true;

  if (rule.triggerType === "card.moved") {
    const to = config.toColumnId;
    const from = config.fromColumnId;
    if (includesString(to) && context.event?.toColumnId !== to) return false;
    if (includesString(from) && context.event?.fromColumnId !== from) return false;
    return true;
  }

  if (rule.triggerType === "card.updated") {
    const fields = Array.isArray(config.fields)
      ? config.fields.filter(includesString)
      : [];
    const customFieldIds = Array.isArray(config.customFieldIds)
      ? config.customFieldIds.filter(includesString)
      : [];
    if (fields.length === 0 && customFieldIds.length === 0) return true;

    const changedFields = context.event?.changedFields ?? [];
    const changedCustom = context.event?.changedCustomFieldIds ?? [];
    const fieldHit = fields.some((field) => changedFields.includes(field));
    const customHit = customFieldIds.some((id) => changedCustom.includes(id));
    return fieldHit || customHit;
  }

  return true;
}

function matchesConditions(card: AutomationCard, conditions: Condition[]): boolean {
  const now = Date.now();

  for (const condition of conditions) {
    if (condition.type === "in_column") {
      if (!card.columnId || !condition.columnIds.includes(card.columnId)) return false;
    } else if (condition.type === "label_includes") {
      if (!card.labels.some((label) => condition.labelIds.includes(label.id))) {
        return false;
      }
    } else if (condition.type === "label_excludes") {
      if (card.labels.some((label) => condition.labelIds.includes(label.id))) {
        return false;
      }
    } else if (condition.type === "priority_in") {
      if (!condition.values.includes(card.priority)) return false;
    } else if (condition.type === "assignee_in") {
      if (!card.assignees.some((id) => condition.userIds.includes(id))) return false;
    } else if (condition.type === "title_contains") {
      if (!card.title.toLowerCase().includes(condition.text.toLowerCase())) {
        return false;
      }
    } else if (condition.type === "due_within_days") {
      if (!card.dueAt) return false;
      const due = new Date(card.dueAt).getTime();
      if (!(due >= now && due <= now + condition.days * 86400000)) return false;
    } else if (condition.type === "field_equals") {
      const value = card.fieldValues[condition.fieldId];
      if (!valuesEqual(value, condition.value)) return false;
    }
  }

  return true;
}

function actionSummary(actions: Action[]): string {
  return actions
    .map((action) => {
      if (action.type === "move_to_column") return "移动到列";
      if (action.type === "add_label") return "添加标签";
      if (action.type === "remove_label") return "移除标签";
      if (action.type === "set_priority") return "设置优先级";
      if (action.type === "set_assignee") return "添加负责人";
      if (action.type === "clear_assignees") return "清空负责人";
      if (action.type === "set_due_at") return "设置截止时间";
      if (action.type === "clear_due_at") return "清空截止时间";
      if (action.type === "archive_card") return "归档卡片";
      if (action.type === "add_comment") return "添加评论";
      return "未知动作";
    })
    .join("、");
}

async function recordRun(options: {
  rule: Automation;
  cardId: string;
  status: "success" | "skipped" | "error";
  message: string;
  runId?: number;
  dedupeKey?: string | null;
}): Promise<void> {
  const sql = await getDb();
  if (options.runId !== undefined) {
    await sql`
      UPDATE vk_automation_runs
      SET status = ${options.status}, message = ${options.message}
      WHERE id = ${options.runId}
    `;
    return;
  }

  await sql`
    INSERT INTO vk_automation_runs (
      automation_id, project_id, card_id, status, message, dedupe_key
    )
    VALUES (
      ${options.rule.id}, ${options.rule.projectId}, ${options.cardId},
      ${options.status}, ${options.message}, ${options.dedupeKey ?? null}
    )
  `;
}

async function recordActivity(
  rule: Automation,
  cardId: string,
  actorId: string | null,
  actions: Action[],
  message: string
) {
  const sql = await getDb();
  await sql`
    INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
    VALUES (
      ${rule.projectId}, ${cardId}, ${actorId}, 'automation.run',
      ${JSON.stringify({
        automationName: rule.name,
        actions: actionSummary(actions),
        message,
      })}::jsonb
    )
  `;
}

async function runNestedEvent(
  rule: Automation,
  cardId: string,
  context: RunContext,
  triggerType: "card.moved" | "card.updated",
  event: AutomationEvent
): Promise<boolean> {
  if (context.depth + 1 > 3) return false;
  return runEventAutomations({
    projectId: rule.projectId,
    cardId,
    triggerType,
    actorId: context.actorId,
    event,
    depth: context.depth + 1,
    ranRuleIds: context.ranRuleIds,
  });
}

async function executeActions(
  rule: Automation,
  card: AutomationCard,
  context: RunContext
): Promise<{ applied: boolean; message: string }> {
  const sql = await getDb();
  const actions = asActions(rule.actions);
  let applied = false;
  let message = "";
  let currentColumnId = card.columnId;

  for (const action of actions) {
    if (action.type === "move_to_column") {
      if (currentColumnId === action.columnId) continue;

      const columnRows = (await sql`
        SELECT id, title, wip_limit FROM vk_columns
        WHERE id = ${action.columnId} AND project_id = ${rule.projectId}
        LIMIT 1
      `) as unknown as Array<{ id: string; title: string; wip_limit: number | null }>;
      const target = columnRows[0];
      if (!target) throw new Error("目标列不存在");

      if (target.wip_limit != null) {
        const countRows = (await sql`
          SELECT count(*)::int AS count FROM vk_cards
          WHERE column_id = ${action.columnId}
            AND archived_at IS NULL
            AND id <> ${card.id}
        `) as unknown as Array<{ count: number }>;
        if (Number(countRows[0]?.count ?? 0) >= target.wip_limit) {
          throw new Error("目标列已达到 WIP 上限");
        }
      }

      const positionRows = (await sql`
        SELECT COALESCE(MAX(position), 0) + 1000 AS next_position
        FROM vk_cards WHERE column_id = ${action.columnId} AND archived_at IS NULL
      `) as unknown as Array<{ next_position: number }>;

      await sql`
        UPDATE vk_cards
        SET column_id = ${action.columnId},
            position = ${Number(positionRows[0]?.next_position ?? 1000)}
        WHERE id = ${card.id}
      `;
      const fromColumnId = currentColumnId;
      const fromTitle = card.columnTitle;
      currentColumnId = action.columnId;
      applied = true;
      message = `移动到「${target.title}」`;

      await sql`
        INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
        VALUES (
          ${rule.projectId}, ${card.id}, ${context.actorId}, 'card.moved',
          ${JSON.stringify({
            cardTitle: card.title,
            fromColumn: fromTitle,
            toColumn: target.title,
            automation: rule.name,
          })}::jsonb
        )
      `;

      await runNestedEvent(rule, card.id, context, "card.moved", {
        fromColumnId,
        toColumnId: action.columnId,
      });
      continue;
    }

    if (action.type === "add_label" || action.type === "remove_label") {
      const labelRows = (await sql`
        SELECT id, name FROM vk_labels
        WHERE id = ${action.labelId} AND project_id = ${rule.projectId}
        LIMIT 1
      `) as unknown as Array<{ id: string; name: string }>;
      const label = labelRows[0];
      if (!label) throw new Error("标签不存在");

      if (action.type === "add_label") {
        await sql`
          INSERT INTO vk_card_labels (card_id, label_id)
          VALUES (${card.id}, ${action.labelId})
          ON CONFLICT DO NOTHING
        `;
        message = `添加标签「${label.name}」`;
      } else {
        await sql`
          DELETE FROM vk_card_labels
          WHERE card_id = ${card.id} AND label_id = ${action.labelId}
        `;
        message = `移除标签「${label.name}」`;
      }
      applied = true;
      await runNestedEvent(rule, card.id, context, "card.updated", {
        changedFields: ["labels"],
      });
      continue;
    }

    if (action.type === "set_priority") {
      await sql`
        UPDATE vk_cards SET priority = ${action.priority} WHERE id = ${card.id}
      `;
      applied = true;
      message = "设置优先级";
      await runNestedEvent(rule, card.id, context, "card.updated", {
        changedFields: ["priority"],
      });
      continue;
    }

    if (action.type === "set_assignee") {
      const memberRows = (await sql`
        SELECT user_id FROM vk_project_members
        WHERE project_id = ${rule.projectId} AND user_id = ${action.userId}
        LIMIT 1
      `) as unknown as Array<{ user_id: string }>;
      if (!memberRows[0]) throw new Error("负责人不是项目成员");

      await sql`
        INSERT INTO vk_card_assignees (card_id, user_id)
        VALUES (${card.id}, ${action.userId})
        ON CONFLICT DO NOTHING
      `;
      applied = true;
      message = "添加负责人";
      await runNestedEvent(rule, card.id, context, "card.updated", {
        changedFields: ["assignee"],
      });
      continue;
    }

    if (action.type === "clear_assignees") {
      await sql`DELETE FROM vk_card_assignees WHERE card_id = ${card.id}`;
      applied = true;
      message = "清空负责人";
      await runNestedEvent(rule, card.id, context, "card.updated", {
        changedFields: ["assignee"],
      });
      continue;
    }

    if (action.type === "set_due_at") {
      await sql`
        UPDATE vk_cards
        SET due_at = now() + make_interval(days => ${action.days})
        WHERE id = ${card.id}
      `;
      applied = true;
      message = `设置截止时间（${action.days} 天后）`;
      await runNestedEvent(rule, card.id, context, "card.updated", {
        changedFields: ["due_at"],
      });
      continue;
    }

    if (action.type === "clear_due_at") {
      await sql`UPDATE vk_cards SET due_at = NULL WHERE id = ${card.id}`;
      applied = true;
      message = "清空截止时间";
      await runNestedEvent(rule, card.id, context, "card.updated", {
        changedFields: ["due_at"],
      });
      continue;
    }

    if (action.type === "add_comment") {
      await sql`
        INSERT INTO vk_comments (card_id, user_id, body)
        VALUES (${card.id}, ${context.actorId}, ${action.body})
      `;
      applied = true;
      message = "添加评论";
      continue;
    }

    if (action.type === "archive_card") {
      await sql`
        UPDATE vk_cards SET archived_at = now() WHERE id = ${card.id}
      `;
      await sql`
        INSERT INTO vk_activities (project_id, card_id, user_id, type, data)
        VALUES (
          ${rule.projectId}, ${card.id}, ${context.actorId}, 'card.archived',
          ${JSON.stringify({ cardTitle: card.title, automation: rule.name })}::jsonb
        )
      `;
      applied = true;
      message = "归档卡片";
      break;
    }
  }

  if (applied) {
    await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${rule.projectId}`;
  }

  return { applied, message };
}

async function executeRule(
  rule: Automation,
  cardId: string,
  context: RunContext,
  options?: { runId?: number; dedupeKey?: string | null }
): Promise<boolean> {
  const card = await getAutomationCard(rule.projectId, cardId);
  if (!card || card.archivedAt) {
    await recordRun({
      rule,
      cardId,
      status: "skipped",
      message: "卡片不存在或已归档",
      runId: options?.runId,
      dedupeKey: options?.dedupeKey,
    });
    return false;
  }

  if (!matchesConditions(card, asConditions(rule.conditions))) {
    await recordRun({
      rule,
      cardId,
      status: "skipped",
      message: "条件不满足",
      runId: options?.runId,
      dedupeKey: options?.dedupeKey,
    });
    return false;
  }

  try {
    const result = await executeActions(rule, card, context);
    await recordRun({
      rule,
      cardId,
      status: "success",
      message: result.message || "执行完成",
      runId: options?.runId,
      dedupeKey: options?.dedupeKey,
    });
    await recordActivity(rule, cardId, context.actorId, asActions(rule.actions), result.message);
    if (result.applied) {
      revalidatePath(`/projects/${rule.projectId}`);
      revalidatePath("/projects");
    }
    return result.applied;
  } catch (error) {
    const message = error instanceof Error ? error.message : "执行失败";
    await recordRun({
      rule,
      cardId,
      status: "error",
      message,
      runId: options?.runId,
      dedupeKey: options?.dedupeKey,
    });
    console.error("automation failed", rule.id, error);
    return false;
  }
}

export async function runEventAutomations(options: {
  projectId: string;
  cardId: string;
  triggerType: "card.created" | "card.moved" | "card.updated";
  actorId: string | null;
  event?: AutomationEvent;
  depth: number;
  ranRuleIds: Set<string>;
}): Promise<boolean> {
  if (options.depth > 3) return false;

  const rules = await getProjectAutomationsByTrigger(
    options.projectId,
    options.triggerType
  );

  let applied = false;
  const context: RunContext = {
    triggerType: options.triggerType,
    actorId: options.actorId,
    event: options.event,
    depth: options.depth,
    ranRuleIds: options.ranRuleIds,
  };

  for (const rule of rules) {
    if (options.ranRuleIds.has(rule.id)) continue;
    if (!matchesTrigger(rule, context)) continue;
    options.ranRuleIds.add(rule.id);
    const changed = await executeRule(rule, options.cardId, context);
    applied = applied || changed;
  }

  return applied;
}

function dueSoonDedupeKey(card: AutomationCard, days: number): string {
  return `${card.id}:${card.dueAt}:${days}`;
}

function overdueDedupeKey(card: AutomationCard): string {
  return `${card.id}:${card.dueAt}`;
}

function staleDedupeKey(card: AutomationCard, columnId: string, days: number): string {
  return `${card.id}:${columnId}:${card.columnEnteredAt}:${days}`;
}

async function runDailyRule(rule: Automation): Promise<number> {
  const sql = await getDb();
  const config = rule.triggerConfig;
  const limit = 500;
  let candidates: Array<{ id: string }> = [];

  if (rule.triggerType === "card.due_soon") {
    const days = Number(config.days ?? 3);
    candidates = (await sql`
      SELECT c.id
      FROM vk_cards c
      JOIN vk_columns col ON col.id = c.column_id
      WHERE c.project_id = ${rule.projectId}
        AND c.archived_at IS NULL
        AND col.is_done = false
        AND c.due_at IS NOT NULL
        AND c.due_at >= now()
        AND c.due_at < now() + make_interval(days => ${days})
      ORDER BY c.due_at ASC
      LIMIT ${limit}
    `) as unknown as Array<{ id: string }>;
  } else if (rule.triggerType === "card.overdue") {
    candidates = (await sql`
      SELECT c.id
      FROM vk_cards c
      JOIN vk_columns col ON col.id = c.column_id
      WHERE c.project_id = ${rule.projectId}
        AND c.archived_at IS NULL
        AND col.is_done = false
        AND c.due_at IS NOT NULL
        AND c.due_at < now()
      ORDER BY c.due_at ASC
      LIMIT ${limit}
    `) as unknown as Array<{ id: string }>;
  } else if (rule.triggerType === "card.stale_in_column") {
    const columnId = typeof config.columnId === "string" ? config.columnId : "";
    const days = Number(config.days ?? 30);
    if (!columnId) return 0;
    candidates = (await sql`
      SELECT id
      FROM vk_cards
      WHERE project_id = ${rule.projectId}
        AND column_id = ${columnId}
        AND archived_at IS NULL
        AND column_entered_at < now() - make_interval(days => ${days})
      ORDER BY column_entered_at ASC
      LIMIT ${limit}
    `) as unknown as Array<{ id: string }>;
  }

  let executed = 0;

  for (const candidate of candidates) {
    const card = await getAutomationCard(rule.projectId, candidate.id);
    if (!card) continue;
    if (!matchesConditions(card, asConditions(rule.conditions))) continue;

    const dedupeKey =
      rule.triggerType === "card.due_soon"
        ? dueSoonDedupeKey(card, Number(config.days ?? 3))
        : rule.triggerType === "card.overdue"
          ? overdueDedupeKey(card)
          : staleDedupeKey(
              card,
              typeof config.columnId === "string" ? config.columnId : "",
              Number(config.days ?? 30)
            );

    const claim = (await sql`
      INSERT INTO vk_automation_runs (
        automation_id, project_id, card_id, status, message, dedupe_key
      )
      VALUES (
        ${rule.id}, ${rule.projectId}, ${card.id},
        'skipped', 'pending', ${dedupeKey}
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `) as unknown as Array<{ id: string }>;

    const runId = claim[0]?.id;
    if (!runId) continue;

    await executeRule(
      rule,
      card.id,
      {
        triggerType: rule.triggerType,
        actorId: null,
        depth: 0,
        ranRuleIds: new Set<string>(),
      },
      { runId: Number(runId), dedupeKey }
    );
    executed += 1;
  }

  return executed;
}

export async function runDailyAutomations(): Promise<{
  rules: number;
  cards: number;
}> {
  const triggerTypes = ["card.due_soon", "card.overdue", "card.stale_in_column"];
  let rules = 0;
  let cards = 0;

  for (const triggerType of triggerTypes) {
    const automations = await getEnabledAutomationsByTrigger(triggerType);
    for (const rule of automations) {
      rules += 1;
      cards += await runDailyRule(rule);
    }
  }

  return { rules, cards };
}
