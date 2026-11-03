import "server-only";
import { getDb } from "@/lib/db";
import { toISO, toInt } from "@/lib/db/serialize";
import type {
  MyTask,
  Priority,
  ProjectRole,
  ProjectSummary,
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
  created_at: string | Date;
  updated_at: string | Date;
  member_role: ProjectRole | null;
  member_count: number;
  total_cards: number;
  done_cards: number;
  overdue_cards: number;
  due_soon_cards: number;
};

type MemberRow = {
  project_id: string;
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: ProjectRole;
  created_at: string | Date;
};

type AccessProjectRow = {
  id: string;
  name: string;
  description: string;
  color: string;
  owner_id: string;
  archived_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type MyTaskRow = {
  card_id: string;
  project_id: string;
  project_name: string;
  project_color: string;
  column_id: string;
  column_title: string;
  title: string;
  priority: Priority;
  due_at: string | Date | null;
};

export async function getProjectAccess(
  projectId: string,
  user: SessionUser
): Promise<{
  project: AccessProjectRow;
  role: ProjectRole;
  isAdmin: boolean;
} | null> {
  const sql = await getDb();
  const projects = (await sql`
    SELECT id, name, description, color, owner_id, archived_at, created_at, updated_at
    FROM vk_projects
    WHERE id = ${projectId}
    LIMIT 1
  `) as unknown as AccessProjectRow[];

  const project = projects[0];
  if (!project) return null;

  const isAdmin = user.role === "admin";
  if (isAdmin) {
    return { project, role: "owner", isAdmin: true };
  }

  const memberships = (await sql`
    SELECT role FROM vk_project_members
    WHERE project_id = ${projectId} AND user_id = ${user.id}
    LIMIT 1
  `) as unknown as Array<{ role: ProjectRole }>;

  const membership = memberships[0];
  if (!membership) return null;

  return { project, role: membership.role, isAdmin: false };
}

export async function getProjectsForUser(
  user: SessionUser
): Promise<ProjectSummary[]> {
  const sql = await getDb();
  const isAdmin = user.role === "admin";

  const rows = (await sql`
    SELECT
      p.id,
      p.name,
      p.description,
      p.color,
      p.owner_id,
      p.archived_at,
      p.created_at,
      p.updated_at,
      pm.role AS member_role,
      (SELECT count(*)::int FROM vk_project_members m WHERE m.project_id = p.id) AS member_count,
      (SELECT count(*)::int FROM vk_cards c WHERE c.project_id = p.id AND c.archived_at IS NULL) AS total_cards,
      (
        SELECT count(*)::int
        FROM vk_cards c
        JOIN vk_columns col ON col.id = c.column_id
        WHERE c.project_id = p.id AND c.archived_at IS NULL AND col.is_done = true
      ) AS done_cards,
      (
        SELECT count(*)::int
        FROM vk_cards c
        JOIN vk_columns col ON col.id = c.column_id
        WHERE c.project_id = p.id
          AND c.archived_at IS NULL
          AND col.is_done = false
          AND c.due_at IS NOT NULL
          AND c.due_at < now()
      ) AS overdue_cards,
      (
        SELECT count(*)::int
        FROM vk_cards c
        JOIN vk_columns col ON col.id = c.column_id
        WHERE c.project_id = p.id
          AND c.archived_at IS NULL
          AND col.is_done = false
          AND c.due_at >= now()
          AND c.due_at < now() + interval '7 days'
      ) AS due_soon_cards
    FROM vk_projects p
    LEFT JOIN vk_project_members pm
      ON pm.project_id = p.id AND pm.user_id = ${user.id}
    WHERE ${isAdmin}::boolean OR pm.user_id IS NOT NULL
    ORDER BY p.updated_at DESC
  `) as unknown as ProjectRow[];

  const projectIds = rows.map((row) => row.id);
  let membersByProject = new Map<string, UserSummary[]>();

  if (projectIds.length > 0) {
    const memberRows = (await sql.query(
      `SELECT m.project_id, u.id, u.username, u.display_name, u.email, m.role, m.created_at
       FROM vk_project_members m
       JOIN vk_users u ON u.id = m.user_id
       WHERE m.project_id = ANY($1::uuid[])
       ORDER BY
         CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
         u.display_name ASC`,
      [projectIds]
    )) as unknown as MemberRow[];

    membersByProject = memberRows.reduce((map, row) => {
      const list = map.get(row.project_id) ?? [];
      list.push({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
      });
      map.set(row.project_id, list);
      return map;
    }, new Map<string, UserSummary[]>());
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    ownerId: row.owner_id,
    archivedAt: toISO(row.archived_at),
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: toISO(row.updated_at) ?? new Date(0).toISOString(),
    role: isAdmin ? "owner" : row.member_role ?? "viewer",
    isAdmin,
    memberCount: toInt(row.member_count),
    totalCards: toInt(row.total_cards),
    doneCards: toInt(row.done_cards),
    overdueCards: toInt(row.overdue_cards),
    dueSoonCards: toInt(row.due_soon_cards),
    members: membersByProject.get(row.id) ?? [],
  }));
}

export type SidebarProject = {
  id: string;
  name: string;
  color: string;
};

export async function getSidebarProjects(
  user: SessionUser
): Promise<SidebarProject[]> {
  const sql = await getDb();
  const isAdmin = user.role === "admin";
  const rows = (await sql`
    SELECT p.id, p.name, p.color
    FROM vk_projects p
    LEFT JOIN vk_project_members pm
      ON pm.project_id = p.id AND pm.user_id = ${user.id}
    WHERE p.archived_at IS NULL
      AND (${isAdmin}::boolean OR pm.user_id IS NOT NULL)
    ORDER BY p.updated_at DESC
    LIMIT 30
  `) as unknown as Array<{ id: string; name: string; color: string }>;

  return rows;
}

export async function getProjectMembers(projectId: string) {
  const sql = await getDb();
  const rows = (await sql`
    SELECT m.project_id, u.id, u.username, u.display_name, u.email, m.role, m.created_at
    FROM vk_project_members m
    JOIN vk_users u ON u.id = m.user_id
    WHERE m.project_id = ${projectId}
    ORDER BY
      CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
      u.display_name ASC
  `) as unknown as MemberRow[];

  return rows.map((row) => ({
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
    },
    role: row.role,
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
  }));
}

export async function getMyTasks(userId: string): Promise<MyTask[]> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT
      c.id AS card_id,
      p.id AS project_id,
      p.name AS project_name,
      p.color AS project_color,
      col.id AS column_id,
      col.title AS column_title,
      c.title,
      c.priority,
      c.due_at
    FROM vk_card_assignees a
    JOIN vk_cards c ON c.id = a.card_id
    JOIN vk_columns col ON col.id = c.column_id
    JOIN vk_projects p ON p.id = c.project_id
    WHERE a.user_id = ${userId}
      AND c.archived_at IS NULL
      AND col.is_done = false
      AND p.archived_at IS NULL
    ORDER BY c.due_at NULLS LAST, c.created_at DESC
    LIMIT 10
  `) as unknown as MyTaskRow[];

  return rows.map((row) => ({
    cardId: row.card_id,
    projectId: row.project_id,
    projectName: row.project_name,
    projectColor: row.project_color,
    columnId: row.column_id,
    columnTitle: row.column_title,
    title: row.title,
    priority: row.priority,
    dueAt: toISO(row.due_at),
  }));
}

export async function touchProject(projectId: string): Promise<void> {
  const sql = await getDb();
  await sql`UPDATE vk_projects SET updated_at = now() WHERE id = ${projectId}`;
}
