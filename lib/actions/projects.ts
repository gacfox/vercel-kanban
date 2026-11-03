"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import {
  requireProjectRole,
  requireProjectWrite,
} from "@/lib/services/permissions";
import { getActiveUserById } from "@/lib/db/queries/users";
import { DEFAULT_COLUMNS } from "@/lib/constants";
import {
  addMemberSchema,
  archiveProjectSchema,
  createProjectSchema,
  deleteProjectSchema,
  removeMemberSchema,
  transferOwnerSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
} from "@/lib/validation/project";
import type { ActionResult } from "@/lib/types";

function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function formToObject(formData: FormData): Record<string, unknown> {
  return Object.fromEntries(formData.entries());
}

function revalidateProject(projectId: string) {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/settings`);
  revalidatePath(`/projects/${projectId}/archive`);
}

export async function createProjectAction(
  _prevState: ActionResult<{ projectId: string }> | null,
  formData: FormData
): Promise<ActionResult<{ projectId: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("请先登录");

  const parsed = createProjectSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("请检查表单", parsed.error.flatten().fieldErrors);
  }

  const { name, description, color, template } = parsed.data;
  const projectId = randomUUID();
  const sql = await getDb();

  const columns =
    template === "default"
      ? DEFAULT_COLUMNS.map((column) => ({
          id: randomUUID(),
          ...column,
        }))
      : [];

  const queries = [
    sql`
      INSERT INTO vk_projects (id, name, description, color, owner_id)
      VALUES (${projectId}, ${name}, ${description}, ${color}, ${user.id})
    `,
    sql`
      INSERT INTO vk_project_members (project_id, user_id, role)
      VALUES (${projectId}, ${user.id}, 'owner')
    `,
    ...columns.map(
      (column) => sql`
        INSERT INTO vk_columns (id, project_id, title, position, is_done)
        VALUES (${column.id}, ${projectId}, ${column.title}, ${column.position}, ${column.isDone})
      `
    ),
    sql`
      INSERT INTO vk_activities (project_id, user_id, type, data)
      VALUES (${projectId}, ${user.id}, 'project.created', ${JSON.stringify({ name })}::jsonb)
    `,
  ];

  await sql.transaction(queries);
  revalidateProject(projectId);

  return { ok: true, data: { projectId } };
}

export async function updateProjectAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = updateProjectSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return fail("请检查表单", parsed.error.flatten().fieldErrors);
  }

  const { projectId, name, description, color } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  await sql.transaction([
    sql`
      UPDATE vk_projects
      SET name = ${name}, description = ${description}, color = ${color}
      WHERE id = ${projectId}
    `,
    sql`
      INSERT INTO vk_activities (project_id, user_id, type, data)
      VALUES (${projectId}, ${access.user.id}, 'project.updated', ${JSON.stringify({ name })}::jsonb)
    `,
  ]);

  revalidateProject(projectId);
  return { ok: true, data: undefined };
}

export async function archiveProjectAction(
  projectId: string,
  archived: boolean
): Promise<ActionResult> {
  const parsed = archiveProjectSchema.safeParse({ projectId, archived });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectRole(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  await sql.transaction([
    sql`
      UPDATE vk_projects
      SET archived_at = ${archived ? new Date().toISOString() : null}
      WHERE id = ${projectId}
    `,
    sql`
      INSERT INTO vk_activities (project_id, user_id, type, data)
      VALUES (
        ${projectId},
        ${access.user.id},
        ${archived ? "project.archived" : "project.restored"},
        '{}'::jsonb
      )
    `,
  ]);

  revalidateProject(projectId);
  return { ok: true, data: undefined };
}

export async function deleteProjectAction(
  projectId: string,
  confirmName: string
): Promise<ActionResult> {
  const parsed = deleteProjectSchema.safeParse({ projectId, confirmName });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectRole(projectId, "owner");
  if (!access.ok) return fail(access.error);

  if (access.access.project.name !== confirmName.trim()) {
    return fail("项目名称不匹配");
  }

  const sql = await getDb();
  await sql`DELETE FROM vk_projects WHERE id = ${projectId}`;
  revalidatePath("/projects");
  redirect("/projects");
}

export async function addMemberAction(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = addMemberSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("请检查表单", parsed.error.flatten().fieldErrors);

  const { projectId, userId, role } = parsed.data;
  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const target = await getActiveUserById(userId);
  if (!target) return fail("用户不存在或已被禁用");

  const sql = await getDb();
  try {
    await sql.transaction([
      sql`
        INSERT INTO vk_project_members (project_id, user_id, role)
        VALUES (${projectId}, ${userId}, ${role})
      `,
      sql`
        INSERT INTO vk_activities (project_id, user_id, type, data)
        VALUES (
          ${projectId},
          ${access.user.id},
          'project.member_added',
          ${JSON.stringify({ displayName: target.displayName, role })}::jsonb
        )
      `,
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return fail("该用户已经是项目成员");
    }
    throw error;
  }

  revalidateProject(projectId);
  return { ok: true, data: undefined };
}

export async function updateMemberRoleAction(
  projectId: string,
  userId: string,
  role: "editor" | "viewer"
): Promise<ActionResult> {
  const parsed = updateMemberRoleSchema.safeParse({ projectId, userId, role });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    UPDATE vk_project_members
    SET role = ${role}
    WHERE project_id = ${projectId} AND user_id = ${userId} AND role <> 'owner'
    RETURNING user_id
  `) as unknown as Array<{ user_id: string }>;

  if (!rows[0]) return fail("不能修改项目所有者，请先转让所有权");

  await sql`
    INSERT INTO vk_activities (project_id, user_id, type, data)
    VALUES (
      ${projectId},
      ${access.user.id},
      'project.member_role_changed',
      ${JSON.stringify({ userId, role })}::jsonb
    )
  `;

  revalidateProject(projectId);
  return { ok: true, data: undefined };
}

export async function removeMemberAction(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse({ projectId, userId });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const rows = (await sql`
    DELETE FROM vk_project_members
    WHERE project_id = ${projectId} AND user_id = ${userId} AND role <> 'owner'
    RETURNING user_id
  `) as unknown as Array<{ user_id: string }>;

  if (!rows[0]) return fail("不能移除项目所有者，请先转让所有权");

  await sql.transaction([
    sql`
      DELETE FROM vk_card_assignees a
      USING vk_cards c
      WHERE a.card_id = c.id
        AND c.project_id = ${projectId}
        AND a.user_id = ${userId}
    `,
    sql`
      DELETE FROM vk_card_field_values fv
      USING vk_cards c, vk_custom_fields f
      WHERE fv.card_id = c.id
        AND fv.field_id = f.id
        AND c.project_id = ${projectId}
        AND f.type = 'user'
        AND fv.value = ${JSON.stringify(userId)}::jsonb
    `,
    sql`
      INSERT INTO vk_activities (project_id, user_id, type, data)
      VALUES (
        ${projectId},
        ${access.user.id},
        'project.member_removed',
        ${JSON.stringify({ userId })}::jsonb
      )
    `,
  ]);

  revalidateProject(projectId);
  return { ok: true, data: undefined };
}

export async function transferOwnerAction(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  const parsed = transferOwnerSchema.safeParse({ projectId, userId });
  if (!parsed.success) return fail("参数不合法");

  const access = await requireProjectWrite(projectId, "owner");
  if (!access.ok) return fail(access.error);

  const sql = await getDb();
  const targetRows = (await sql`
    SELECT role FROM vk_project_members
    WHERE project_id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `) as unknown as Array<{ role: string }>;

  if (!targetRows[0]) return fail("目标用户不是项目成员");

  await sql.transaction([
    sql`
      UPDATE vk_project_members
      SET role = 'editor'
      WHERE project_id = ${projectId} AND role = 'owner'
    `,
    sql`
      UPDATE vk_project_members
      SET role = 'owner'
      WHERE project_id = ${projectId} AND user_id = ${userId}
    `,
    sql`
      UPDATE vk_projects
      SET owner_id = ${userId}
      WHERE id = ${projectId}
    `,
    sql`
      INSERT INTO vk_activities (project_id, user_id, type, data)
      VALUES (
        ${projectId},
        ${access.user.id},
        'project.owner_transferred',
        ${JSON.stringify({ userId })}::jsonb
      )
    `,
  ]);

  revalidateProject(projectId);
  return { ok: true, data: undefined };
}
