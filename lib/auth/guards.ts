import "server-only";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "./session";
import { getProjectAccess } from "@/lib/db/queries/projects";
import { hasRole } from "@/lib/services/permissions";
import type { ProjectRole } from "@/lib/types";

export async function requireUserPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export async function requireAdminPage() {
  const user = await requireUserPage();
  if (user.role !== "admin") notFound();
  return user;
}

export async function requireProjectAccessPage(
  projectId: string,
  minRole: ProjectRole
) {
  const user = await requireUserPage();
  const access = await getProjectAccess(projectId, user);

  if (!access || !hasRole(access.role, minRole)) notFound();

  return { user, ...access };
}
