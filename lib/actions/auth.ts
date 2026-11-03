"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getAppSettings, updateAppSettings } from "@/lib/db/queries/app-settings";
import { countUsers, getUserForLogin, touchLastLogin } from "@/lib/db/queries/users";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroyCurrentSession,
  getSessionUser,
  revokeOtherSessions,
} from "@/lib/auth/session";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  safeFrom,
  setupSchema,
  updateProfileSchema,
} from "@/lib/validation/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: boolean;
} | null;

function fail(error: string, fieldErrors?: Record<string, string[]>): AuthFormState {
  return { error, fieldErrors };
}

function formToObject(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

async function getUserAgent(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get("user-agent");
}

export async function setupAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const ip = await getClientIp();
  const limited = await rateLimit({
    name: "setup",
    identifier: ip,
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limited.allowed) return fail("尝试次数过多，请稍后再试");

  const parsed = setupSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("请检查表单", parsed.error.flatten().fieldErrors);
  }

  const initialized = (await countUsers()) > 0;
  if (initialized) return fail("系统已初始化，请直接登录");

  const {
    siteName,
    username,
    email,
    displayName,
    password,
  } = parsed.data;

  const passwordHash = await hashPassword(password);
  const userId = randomUUID();
  const sql = await getDb();

  const rows = (await sql`
    INSERT INTO vk_users (
      id, username, email, display_name, password_hash, role, status, must_change_password
    )
    SELECT
      ${userId}, ${username}, ${email}, ${displayName}, ${passwordHash},
      'admin', 'active', false
    WHERE NOT EXISTS (SELECT 1 FROM vk_users)
    RETURNING id
  `) as unknown as Array<{ id: string }>;

  if (!rows[0]) return fail("系统已初始化，请直接登录");

  await updateAppSettings({ siteName });
  await createSession(userId, await getUserAgent());
  revalidatePath("/", "layout");
  redirect("/projects");
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("请检查表单", parsed.error.flatten().fieldErrors);
  }

  const { login, password, from } = parsed.data;
  const ip = await getClientIp();
  const limited = await rateLimit({
    name: "login",
    identifier: `${ip}:${login.toLowerCase()}`,
    limit: 10,
    windowSeconds: 600,
  });
  if (!limited.allowed) return fail("尝试次数过多，请稍后再试");

  const user = await getUserForLogin(login);
  if (!user) return fail("用户名或密码错误");

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return fail("用户名或密码错误");

  if (user.status !== "active") {
    return fail("账号已被禁用，请联系管理员");
  }

  await createSession(user.id, await getUserAgent());
  await touchLastLogin(user.id);
  revalidatePath("/", "layout");
  redirect(safeFrom(from));
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const settings = await getAppSettings();
  if (!settings.allowRegistration) {
    return fail("当前未开放注册");
  }

  const ip = await getClientIp();
  const limited = await rateLimit({
    name: "register",
    identifier: ip,
    limit: 5,
    windowSeconds: 3600,
  });
  if (!limited.allowed) return fail("尝试次数过多，请稍后再试");

  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("请检查表单", parsed.error.flatten().fieldErrors);
  }

  const { username, email, displayName, password } = parsed.data;
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
        'user', 'active', false
      )
    `;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505") return fail("用户名或邮箱已被使用");
    console.error("register failed", error);
    return fail("注册失败，请稍后重试");
  }

  await createSession(userId, await getUserAgent());
  revalidatePath("/", "layout");
  redirect("/projects");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function changePasswordAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) return fail("请先登录");

  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("请检查表单", parsed.error.flatten().fieldErrors);
  }

  const { currentPassword, newPassword } = parsed.data;
  const sql = await getDb();
  const rows = (await sql`
    SELECT password_hash FROM vk_users WHERE id = ${user.id} LIMIT 1
  `) as unknown as Array<{ password_hash: string }>;

  const stored = rows[0]?.password_hash;
  if (!stored) return fail("账号不存在");

  const valid = await verifyPassword(currentPassword, stored);
  if (!valid) {
    return fail("当前密码不正确", { currentPassword: ["当前密码不正确"] });
  }

  const newHash = await hashPassword(newPassword);
  await sql`
    UPDATE vk_users
    SET password_hash = ${newHash}, must_change_password = false
    WHERE id = ${user.id}
  `;

  if (user.sessionId) {
    await revokeOtherSessions(user.id, user.sessionId);
  }

  revalidatePath("/", "layout");
  redirect("/projects");
}

export async function updateProfileAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) return fail("请先登录");

  const parsed = updateProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("请检查表单", parsed.error.flatten().fieldErrors);
  }

  const sql = await getDb();
  await sql`
    UPDATE vk_users
    SET display_name = ${parsed.data.displayName}
    WHERE id = ${user.id}
  `;

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}
