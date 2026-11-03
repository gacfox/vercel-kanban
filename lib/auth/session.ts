import "server-only";
import { cache } from "react";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { toISO } from "@/lib/db/serialize";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/constants";
import type { GlobalRole, SessionUser } from "@/lib/types";

type SessionRow = {
  session_id: string;
  id: string;
  username: string;
  email: string;
  display_name: string;
  role: GlobalRole;
  must_change_password: boolean;
  created_at: string | Date;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapSessionUser(row: SessionRow): SessionUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
    createdAt: toISO(row.created_at) ?? new Date(0).toISOString(),
    sessionId: row.session_id,
  };
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sql = await getDb();
  const rows = (await sql`
    SELECT
      s.id AS session_id,
      u.id,
      u.username,
      u.email,
      u.display_name,
      u.role,
      u.must_change_password,
      u.created_at
    FROM vk_sessions s
    JOIN vk_users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)}
      AND s.expires_at > now()
      AND u.status = 'active'
    LIMIT 1
  `) as unknown as SessionRow[];

  const row = rows[0];
  return row ? mapSessionUser(row) : null;
});

export async function createSession(
  userId: string,
  userAgent?: string | null
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const sql = await getDb();

  await sql`
    INSERT INTO vk_sessions (token_hash, user_id, user_agent, expires_at)
    VALUES (
      ${tokenHash},
      ${userId},
      ${userAgent ?? null},
      now() + interval '30 days'
    )
  `;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const sql = await getDb();
    await sql`DELETE FROM vk_sessions WHERE token_hash = ${hashToken(token)}`;
  }

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function revokeUserSessions(userId: string): Promise<void> {
  const sql = await getDb();
  await sql`DELETE FROM vk_sessions WHERE user_id = ${userId}`;
}

export async function revokeOtherSessions(
  userId: string,
  currentSessionId: string
): Promise<void> {
  const sql = await getDb();
  await sql`
    DELETE FROM vk_sessions
    WHERE user_id = ${userId} AND id <> ${currentSessionId}
  `;
}

export async function cleanupExpiredSessions(): Promise<void> {
  const sql = await getDb();
  await sql`DELETE FROM vk_sessions WHERE expires_at < now()`;
}
