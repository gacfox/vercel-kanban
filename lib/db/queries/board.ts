import "server-only";
import { getDb } from "@/lib/db";
import { parseJson, toISO, toInt } from "@/lib/db/serialize";
import { getProjectMembers } from "@/lib/db/queries/projects";
import { hasRole } from "@/lib/services/permissions";
import type {
  Activity,
  ArchivedCard,
  BoardCard,
  BoardColumn,
  BoardData,
  CardDetail,
  ColumnHistoryResult,
  Comment,
  CustomField,
  FieldType,
  Label,
  Priority,
  ProjectRole,
  ProjectSettingsData,
  SessionUser,
  UserSummary,
} from "@/lib/types";

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  color: string;
  owner_id: string;
  archived_at: string | Date | null;
  updated_at: string | Date;
};

type ColumnRow = {
  id: string;
  project_id: string;
  title: string;
  position: number;
  wip_limit: number | null;
  history_window_days: number | null;
  is_done: boolean;
  total_count: number;
};

type CardRow = {
  id: string;
  project_id: string;
  column_id: string | null;
  title: string;
  description: string;
  position: number;
  priority: Priority;
  due_at: string | Date | null;
  column_entered_at: string | Date;
  archived_at: string | Date | null;
  created_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  labels: unknown;
  assignees: unknown;
  field_values: unknown;
  comment_count: number;
  column_title?: string | null;
};

type LabelRow = {
  id: string;
  name: string;
  color: string;
  position: number;
};

type FieldRow = {
  id: string;
  name: string;
  type: FieldType;
  options: unknown;
  position: number;
  show_on_card: boolean;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
};

type ActivityRow = {
  id: string | number;
  type: string;
  data: unknown;
  created_at: string | Date;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
};

const CARD_FIELDS = `
    c.id,
    c.project_id,
    c.column_id,
    c.title,
    c.description,
    c.position,
    c.priority,
    c.due_at,
    c.column_entered_at,
    c.archived_at,
    c.created_by,
    c.created_at,
    c.updated_at,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', l.id,
          'name', l.name,
          'color', l.color,
          'position', l.position
        )
        ORDER BY l.name ASC
      )
      FROM vk_card_labels cl
      JOIN vk_labels l ON l.id = cl.label_id
      WHERE cl.card_id = c.id
    ), '[]'::json) AS labels,
    COALESCE((
      SELECT json_agg(
        json_build_object(
          'id', u.id,
          'username', u.username,
          'displayName', u.display_name
        )
        ORDER BY u.display_name ASC
      )
      FROM vk_card_assignees ca
      JOIN vk_users u ON u.id = ca.user_id
      WHERE ca.card_id = c.id
    ), '[]'::json) AS assignees,
    COALESCE((
      SELECT json_object_agg(fv.field_id, fv.value)
      FROM vk_card_field_values fv
      WHERE fv.card_id = c.id
    ), '{}'::json) AS field_values,
    (
      SELECT count(*)::int FROM vk_comments cm
      WHERE cm.card_id = c.id AND cm.deleted_at IS NULL
    ) AS comment_count
`;

function mapCard(row: CardRow): BoardCard {
  return {
    id: row.id,
    projectId: row.project_id,
    columnId: row.column_id,
    title: row.title,
    description: row.description,
    position: toInt(row.position),
    priority: row.priority,
    dueAt: toISO(row.due_at),
    columnEnteredAt: toISO(row.column_entered_at) ?? new Date(0).toISOString(),
    archivedAt: toISO(row.archived_at),
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toISO(row.updated_at) ?? new Date(0).toISOString(),
    createdBy: row.created_by,
    labels: parseJson<Label[]>(row.labels, []),
    assignees: parseJson<UserSummary[]>(row.assignees, []),
    fieldValues: parseJson<Record<string, unknown>>(row.field_values, {}),
    commentCount: toInt(row.comment_count),
  };
}

function mapProject(row: ProjectRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    ownerId: row.owner_id,
    archivedAt: toISO(row.archived_at),
    updatedAt: toISO(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapColumns(rows: ColumnRow[]): BoardColumn[] {
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    position: toInt(row.position),
    wipLimit: row.wip_limit == null ? null : toInt(row.wip_limit),
    historyWindowDays:
      row.history_window_days == null ? null : toInt(row.history_window_days),
    isDone: row.is_done,
    visibleCount: 0,
    totalCount: toInt(row.total_count),
    hiddenCount: 0,
  }));
}

function mapLabels(rows: LabelRow[]): Label[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    position: toInt(row.position),
  }));
}

function mapFields(rows: FieldRow[]): CustomField[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    options: parseJson<string[]>(row.options, []),
    position: toInt(row.position),
    showOnCard: row.show_on_card,
  }));
}

function mapComment(row: CommentRow): Comment {
  return {
    id: row.id,
    body: row.body,
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toISO(row.updated_at) ?? new Date(0).toISOString(),
    deletedAt: toISO(row.deleted_at),
    user:
      row.user_id && row.username && row.display_name
        ? {
            id: row.user_id,
            username: row.username,
            displayName: row.display_name,
          }
        : null,
  };
}

function mapActivity(row: ActivityRow): Activity {
  return {
    id: Number(row.id),
    type: row.type,
    data: parseJson<Record<string, unknown>>(row.data, {}),
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    user:
      row.user_id && row.username && row.display_name
        ? {
            id: row.user_id,
            username: row.username,
            displayName: row.display_name,
          }
        : null,
  };
}

async function getSnapshotRevision(projectId: string): Promise<string> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT GREATEST(
      p.updated_at,
      COALESCE((SELECT max(updated_at) FROM vk_columns WHERE project_id = p.id), p.updated_at),
      COALESCE((SELECT max(updated_at) FROM vk_cards WHERE project_id = p.id), p.updated_at),
      COALESCE((
        SELECT max(cm.updated_at)
        FROM vk_comments cm
        JOIN vk_cards c ON c.id = cm.card_id
        WHERE c.project_id = p.id
      ), p.updated_at),
      COALESCE((SELECT max(updated_at) FROM vk_labels WHERE project_id = p.id), p.updated_at),
      COALESCE((SELECT max(updated_at) FROM vk_custom_fields WHERE project_id = p.id), p.updated_at)
    ) AS revision
    FROM vk_projects p
    WHERE p.id = ${projectId}
  `) as unknown as Array<{ revision: string | Date }>;

  return toISO(rows[0]?.revision) ?? new Date().toISOString();
}

export async function getBoardData(
  projectId: string,
  currentUser: SessionUser,
  role: ProjectRole,
  isAdmin: boolean
): Promise<BoardData> {
  const sql = await getDb();

  const [projectRows, columnRows, cardRows, hiddenRows, labelRows, fieldRows, members, revision] =
    await Promise.all([
      sql`
        SELECT id, name, description, color, owner_id, archived_at, updated_at
        FROM vk_projects
        WHERE id = ${projectId}
        LIMIT 1
      ` as unknown as Promise<ProjectRow[]>,
      sql`
        SELECT
          col.*,
          (
            SELECT count(*)::int FROM vk_cards c
            WHERE c.column_id = col.id AND c.archived_at IS NULL
          ) AS total_count
        FROM vk_columns col
        WHERE col.project_id = ${projectId}
        ORDER BY col.position ASC, col.created_at ASC, col.id ASC
      ` as unknown as Promise<ColumnRow[]>,
      sql.query(`SELECT ${CARD_FIELDS}
        FROM vk_cards c
        JOIN vk_columns col ON col.id = c.column_id
        WHERE c.project_id = $1
          AND c.archived_at IS NULL
          AND (
            col.history_window_days IS NULL
            OR c.column_entered_at >= now() - make_interval(days => col.history_window_days)
          )
        ORDER BY col.position ASC, c.position ASC, c.created_at ASC, c.id ASC
      `, [projectId]) as unknown as Promise<CardRow[]>,
      sql`
        SELECT c.column_id, count(*)::int AS hidden_count
        FROM vk_cards c
        JOIN vk_columns col ON col.id = c.column_id
        WHERE c.project_id = ${projectId}
          AND c.archived_at IS NULL
          AND col.history_window_days IS NOT NULL
          AND c.column_entered_at < now() - make_interval(days => col.history_window_days)
        GROUP BY c.column_id
      ` as unknown as Promise<Array<{ column_id: string; hidden_count: number }>>,
      sql`
        SELECT id, name, color, position
        FROM vk_labels
        WHERE project_id = ${projectId}
        ORDER BY position ASC, name ASC
      ` as unknown as Promise<LabelRow[]>,
      sql`
        SELECT id, name, type, options, position, show_on_card
        FROM vk_custom_fields
        WHERE project_id = ${projectId}
        ORDER BY position ASC, name ASC
      ` as unknown as Promise<FieldRow[]>,
      getProjectMembers(projectId),
      getSnapshotRevision(projectId),
    ]);

  const project = projectRows[0];
  if (!project) throw new Error("Project not found");

  const cards = cardRows.map(mapCard);
  const columns = mapColumns(columnRows);
  const hiddenByColumn = new Map(
    hiddenRows.map((row) => [row.column_id, toInt(row.hidden_count)])
  );
  const visibleByColumn = new Map<string, number>();
  cards.forEach((card) => {
    if (card.columnId) {
      visibleByColumn.set(card.columnId, (visibleByColumn.get(card.columnId) ?? 0) + 1);
    }
  });

  const columnsWithCounts = columns.map((column) => {
    const visibleCount = visibleByColumn.get(column.id) ?? 0;
    const hiddenCount = hiddenByColumn.get(column.id) ?? 0;
    return {
      ...column,
      visibleCount,
      hiddenCount,
      totalCount: visibleCount + hiddenCount,
    };
  });

  const canManage = hasRole(role, "owner");
  const canEdit = hasRole(role, "editor") && !project.archived_at;

  return {
    project: mapProject(project),
    columns: columnsWithCounts,
    cards,
    labels: mapLabels(labelRows),
    fields: mapFields(fieldRows),
    members: members.map((member) => ({
      ...member,
      user: {
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
      },
    })),
    role,
    isAdmin,
    canEdit,
    canManage,
    snapshotRevision: revision,
    currentUser,
  };
}

export async function getCardDetail(
  projectId: string,
  cardId: string
): Promise<CardDetail | null> {
  const sql = await getDb();
  const rows = (await sql.query(
    `SELECT ${CARD_FIELDS}
     FROM vk_cards c
     WHERE c.project_id = $1 AND c.id = $2
     LIMIT 1`,
    [projectId, cardId]
  )) as unknown as CardRow[];

  const row = rows[0];
  if (!row) return null;

  const [commentRows, activityRows] = await Promise.all([
    sql`
      SELECT cm.id, cm.body, cm.created_at, cm.updated_at, cm.deleted_at,
             u.id AS user_id, u.username, u.display_name
      FROM vk_comments cm
      LEFT JOIN vk_users u ON u.id = cm.user_id
      WHERE cm.card_id = ${cardId} AND cm.deleted_at IS NULL
      ORDER BY cm.created_at ASC
      LIMIT 200
    ` as unknown as Promise<CommentRow[]>,
    sql`
      SELECT a.id, a.type, a.data, a.created_at,
             u.id AS user_id, u.username, u.display_name
      FROM vk_activities a
      LEFT JOIN vk_users u ON u.id = a.user_id
      WHERE a.card_id = ${cardId}
      ORDER BY a.created_at DESC
      LIMIT 20
    ` as unknown as Promise<ActivityRow[]>,
  ]);

  return {
    card: mapCard(row),
    comments: commentRows.map(mapComment),
    activities: activityRows.map(mapActivity),
  };
}

export async function getColumnHistory(
  projectId: string,
  columnId: string,
  offset: number,
  limit: number
): Promise<ColumnHistoryResult> {
  const sql = await getDb();
  const columnRows = (await sql`
    SELECT id, history_window_days
    FROM vk_columns
    WHERE id = ${columnId} AND project_id = ${projectId}
    LIMIT 1
  `) as unknown as Array<{ id: string; history_window_days: number | null }>;

  const column = columnRows[0];
  if (!column || column.history_window_days == null) {
    return { cards: [], hasMore: false };
  }

  const rows = (await sql.query(
    `SELECT ${CARD_FIELDS}
     FROM vk_cards c
     JOIN vk_columns col ON col.id = c.column_id
     WHERE c.project_id = $1
       AND c.column_id = $2
       AND c.archived_at IS NULL
       AND c.column_entered_at < now() - make_interval(days => $3)
     ORDER BY c.position ASC, c.created_at ASC, c.id ASC
     LIMIT $4 OFFSET $5`,
    [projectId, columnId, column.history_window_days, limit + 1, offset]
  )) as unknown as CardRow[];

  const hasMore = rows.length > limit;
  return {
    cards: rows.slice(0, limit).map(mapCard),
    hasMore,
  };
}

export async function getArchivedCards(
  projectId: string
): Promise<ArchivedCard[]> {
  const sql = await getDb();
  const rows = (await sql.query(
    `SELECT ${CARD_FIELDS}, col.title AS column_title
     FROM vk_cards c
     LEFT JOIN vk_columns col ON col.id = c.column_id
     WHERE c.project_id = $1 AND c.archived_at IS NOT NULL
     ORDER BY c.archived_at DESC, c.updated_at DESC
     LIMIT 1000`,
    [projectId]
  )) as unknown as CardRow[];

  return rows.map((row) => ({
    ...mapCard(row),
    columnTitle: row.column_title ?? null,
  }));
}

export async function getProjectSettingsData(
  projectId: string,
  role: ProjectRole,
  isAdmin: boolean
): Promise<ProjectSettingsData> {
  const sql = await getDb();

  const [projectRows, columnRows, labelRows, fieldRows, members] = await Promise.all([
    sql`
      SELECT id, name, description, color, owner_id, archived_at, updated_at
      FROM vk_projects
      WHERE id = ${projectId}
      LIMIT 1
    ` as unknown as Promise<ProjectRow[]>,
    sql`
      SELECT
        col.*,
        (
          SELECT count(*)::int FROM vk_cards c
          WHERE c.column_id = col.id AND c.archived_at IS NULL
        ) AS total_count
      FROM vk_columns col
      WHERE col.project_id = ${projectId}
      ORDER BY col.position ASC, col.created_at ASC, col.id ASC
    ` as unknown as Promise<ColumnRow[]>,
    sql`
      SELECT id, name, color, position
      FROM vk_labels
      WHERE project_id = ${projectId}
      ORDER BY position ASC, name ASC
    ` as unknown as Promise<LabelRow[]>,
    sql`
      SELECT id, name, type, options, position, show_on_card
      FROM vk_custom_fields
      WHERE project_id = ${projectId}
      ORDER BY position ASC, name ASC
    ` as unknown as Promise<FieldRow[]>,
    getProjectMembers(projectId),
  ]);

  const project = projectRows[0];
  if (!project) throw new Error("Project not found");

  return {
    project: mapProject(project),
    members,
    columns: mapColumns(columnRows),
    labels: mapLabels(labelRows),
    fields: mapFields(fieldRows),
    role,
    isAdmin,
    canManage: hasRole(role, "owner"),
  };
}
