import "server-only";
import { getDb } from "@/lib/db";
import { toISO, toInt } from "@/lib/db/serialize";
import type { AdminUser, GlobalRole, UserSummary } from "@/lib/types";

type CountRow = { count: number };

type LoginUserRow = {
  id: string;
  password_hash: string;
  status: "active" | "disabled";
  role: GlobalRole;
  must_change_password: boolean;
};

type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: GlobalRole;
  status: "active" | "disabled";
  must_change_password: boolean;
  last_login_at: string | Date | null;
  created_at: string | Date;
};

export async function countUsers(): Promise<number> {
  const sql = await getDb();
  const rows = (await sql`SELECT count(*)::int AS count FROM vk_users`) as unknown as CountRow[];
  return toInt(rows[0]?.count);
}

export async function getUserForLogin(login: string) {
  const sql = await getDb();
  const rows = (await sql`
    SELECT id, password_hash, status, role, must_change_password
    FROM vk_users
    WHERE lower(username) = lower(${login}) OR lower(email) = lower(${login})
    LIMIT 1
  `) as unknown as LoginUserRow[];

  return rows[0] ?? null;
}

export async function touchLastLogin(userId: string): Promise<void> {
  const sql = await getDb();
  await sql`UPDATE vk_users SET last_login_at = now() WHERE id = ${userId}`;
}

export async function getAdminUsers(): Promise<AdminUser[]> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT id, username, email, display_name, role, status,
           must_change_password, last_login_at, created_at
    FROM vk_users
    ORDER BY created_at ASC
    LIMIT 500
  `) as unknown as AdminUserRow[];

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    mustChangePassword: row.must_change_password,
    lastLoginAt: toISO(row.last_login_at),
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
  }));
}

export async function getAllUserSummaries(): Promise<
  Array<UserSummary & { email: string }>
> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT id, username, display_name, email
    FROM vk_users
    WHERE status = 'active'
    ORDER BY display_name ASC
    LIMIT 500
  `) as unknown as Array<{
    id: string;
    username: string;
    display_name: string;
    email: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
  }));
}

export async function countActiveAdmins(): Promise<number> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT count(*)::int AS count
    FROM vk_users
    WHERE role = 'admin' AND status = 'active'
  `) as unknown as CountRow[];
  return toInt(rows[0]?.count);
}

export async function getActiveUserById(
  id: string
): Promise<(UserSummary & { email: string }) | null> {
  const sql = await getDb();
  const rows = (await sql`
    SELECT id, username, display_name, email
    FROM vk_users
    WHERE id = ${id} AND status = 'active'
    LIMIT 1
  `) as unknown as Array<{
    id: string;
    username: string;
    display_name: string;
    email: string;
  }>;

  const row = rows[0];
  return row
    ? {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
      }
    : null;
}

export async function searchUsersForProject(
  projectId: string,
  query: string,
  limit = 10
): Promise<Array<UserSummary & { email: string }>> {
  const sql = await getDb();
  const term = `%${query.trim().toLowerCase()}%`;
  const rows = (await sql`
    SELECT u.id, u.username, u.display_name, u.email
    FROM vk_users u
    WHERE u.status = 'active'
      AND (
        lower(u.username) LIKE ${term}
        OR lower(u.email) LIKE ${term}
        OR lower(u.display_name) LIKE ${term}
      )
      AND NOT EXISTS (
        SELECT 1 FROM vk_project_members m
        WHERE m.project_id = ${projectId} AND m.user_id = u.id
      )
    ORDER BY u.display_name ASC
    LIMIT ${limit}
  `) as unknown as Array<{
    id: string;
    username: string;
    display_name: string;
    email: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
  }));
}

