"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionUser, revokeUserSessions } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { countActiveAdmins, getActiveUserById } from "@/lib/db/queries/users";
import { updateAppSettings } from "@/lib/db/queries/app-settings";
import {
  createUserSchema,
  deleteUserSchema,
  resetPasswordSchema,
  updateSiteSettingsSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from "@/lib/validation/admin";
import type { ActionResult } from "@/lib/types";

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function formToObject(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

function revalidateAdmin() {
  revalidatePath("/admin/users");
  revalidatePath("/admin/settings");
  revalidatePath("/projects");
}

export async function createUserAction(
  _prevState: ActionResult<{ userId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ userId: string }>> {
  const admin = await requireAdmin();
  if (!admin) return fail("无权限");

  const parsed = createUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { username, email, displayName, password, role } = parsed.data;
  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  const sql = await getDb();

  try {
    await sql`
      INSERT INTO vk_users (
        id, username, email, display_name, password_hash, role, status, must_change_password
      )
      VALUES (
        ${userId}, ${username}, ${email}, ${displayName}, ${passwordHash},
        ${role}, 'active', true
      )
    `;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return fail("用户名或邮箱已被使用");
    }
    throw error;
  }

  revalidateAdmin();
  return { ok: true, data: { userId } };
}

export async function updateUserRoleAction(
  userId: string,
  role: "admin" | "user"
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("无权限");

  const parsed = updateUserRoleSchema.safeParse({ userId, role });
  if (!parsed.success) return fail("参数不合法");

  const sql = await getDb();
  const rows = (await sql`
    SELECT id, role, status FROM vk_users WHERE id = ${userId} LIMIT 1
  `) as unknown as Array<{ id: string; role: "admin" | "user"; status: "active" | "disabled" }>;

  const target = rows[0];
  if (!target) return fail("用户不存在");

  if (target.role === "admin" && role === "user" && target.status === "active") {
    const admins = await countActiveAdmins();
    if (admins <= 1) return fail("不能降级最后一个管理员");
  }

  await sql`UPDATE vk_users SET role = ${role} WHERE id = ${userId}`;
  revalidateAdmin();
  return { ok: true, data: undefined };
}

export async function updateUserStatusAction(
  userId: string,
  status: "active" | "disabled"
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("无权限");

  const parsed = updateUserStatusSchema.safeParse({ userId, status });
  if (!parsed.success) return fail("参数不合法");

  if (userId === admin.id && status === "disabled") {
    return fail("不能禁用自己");
  }

  const sql = await getDb();
  const rows = (await sql`
    SELECT id, role, status FROM vk_users WHERE id = ${userId} LIMIT 1
  `) as unknown as Array<{ id: string; role: "admin" | "user"; status: "active" | "disabled" }>;

  const target = rows[0];
  if (!target) return fail("用户不存在");

  if (target.role === "admin" && target.status === "active" && status === "disabled") {
    const admins = await countActiveAdmins();
    if (admins <= 1) return fail("不能禁用最后一个管理员");
  }

  await sql`UPDATE vk_users SET status = ${status} WHERE id = ${userId}`;
  if (status === "disabled") {
    await revokeUserSessions(userId);
  }

  revalidateAdmin();
  return { ok: true, data: undefined };
}

export async function resetUserPasswordAction(
  userId: string,
  password: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("无权限");

  const parsed = resetPasswordSchema.safeParse({ userId, password });
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const target = await getActiveUserById(userId);
  if (!target) return fail("用户不存在或已被禁用");

  const passwordHash = await hashPassword(password);
  const sql = await getDb();
  await sql`
    UPDATE vk_users
    SET password_hash = ${passwordHash}, must_change_password = true
    WHERE id = ${userId}
  `;
  await revokeUserSessions(userId);

  revalidateAdmin();
  return { ok: true, data: undefined };
}

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("无权限");

  const parsed = deleteUserSchema.safeParse({ userId });
  if (!parsed.success) return fail("参数不合法");

  if (userId === admin.id) return fail("不能删除自己");

  const sql = await getDb();
  const rows = (await sql`
    SELECT id, role, status FROM vk_users WHERE id = ${userId} LIMIT 1
  `) as unknown as Array<{ id: string; role: "admin" | "user"; status: "active" | "disabled" }>;

  const target = rows[0];
  if (!target) return fail("用户不存在");

  if (target.role === "admin" && target.status === "active") {
    const admins = await countActiveAdmins();
    if (admins <= 1) return fail("不能删除最后一个管理员");
  }

  const owned = (await sql`
    SELECT count(*)::int AS count FROM vk_projects WHERE owner_id = ${userId}
  `) as unknown as Array<{ count: number }>;
  if (Number(owned[0]?.count ?? 0) > 0) {
    return fail("该用户仍是项目所有者，请先转让项目所有权");
  }

  await revokeUserSessions(userId);
  await sql`DELETE FROM vk_users WHERE id = ${userId}`;
  revalidateAdmin();
  return { ok: true, data: undefined };
}

export async function updateSiteSettingsAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!admin) return fail("无权限");

  const parsed = updateSiteSettingsSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  await updateAppSettings({
    siteName: parsed.data.siteName,
    allowRegistration: parsed.data.allowRegistration,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
