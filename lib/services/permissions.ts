import "server-only";
import { ROLE_RANK } from "@/lib/constants";
import { getProjectAccess } from "@/lib/db/queries/projects";
import { getSessionUser } from "@/lib/auth/session";
import type { ProjectRole, SessionUser } from "@/lib/types";

export function hasRole(role: ProjectRole, minRole: ProjectRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export async function requireProjectRole(
  projectId: string,
  minRole: ProjectRole
): Promise<
  | {
      ok: true;
      user: SessionUser;
      access: NonNullable<Awaited<ReturnType<typeof getProjectAccess>>>;
    }
  | { ok: false; error: string }
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "请先登录" };

  const access = await getProjectAccess(projectId, user);
  if (!access || !hasRole(access.role, minRole)) {
    return { ok: false, error: "无权限或资源不存在" };
  }

  return { ok: true, user, access };
}

export async function requireProjectWrite(
  projectId: string,
  minRole: ProjectRole
): Promise<
  | {
      ok: true;
      user: SessionUser;
      access: NonNullable<Awaited<ReturnType<typeof getProjectAccess>>>;
    }
  | { ok: false; error: string }
> {
  const result = await requireProjectRole(projectId, minRole);
  if (!result.ok) return result;

  if (result.access.project.archived_at) {
    return { ok: false, error: "项目已归档，无法修改" };
  }

  return result;
}
