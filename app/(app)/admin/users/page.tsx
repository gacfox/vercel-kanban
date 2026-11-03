import { connection } from "next/server";
import { requireAdminPage } from "@/lib/auth/guards";
import { getAdminUsers } from "@/lib/db/queries/users";
import { AdminUsers } from "@/components/admin/admin-users";

export const instant = false;

export default async function AdminUsersPage() {
  await connection();
  const user = await requireAdminPage();
  const users = await getAdminUsers();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
        <p className="text-sm text-muted-foreground">
          创建账号、调整角色、禁用用户或重置密码。
        </p>
      </div>
      <AdminUsers users={users} currentUserId={user.id} />
    </div>
  );
}
