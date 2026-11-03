import { connection } from "next/server";
import { requireUserPage } from "@/lib/auth/guards";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { LocalDate } from "@/components/shared/local-date";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";

export const instant = false;

export default async function ProfilePage() {
  await connection();
  const user = await requireUserPage();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <UserAvatar id={user.id} name={user.displayName} size="lg" className="size-14 text-lg" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {user.displayName}
            </h1>
            <Badge variant="secondary">
              {user.role === "admin" ? "管理员" : "普通用户"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            @{user.username} · {user.email}
          </p>
          <p className="text-xs text-muted-foreground">
            加入于 <LocalDate value={user.createdAt} />
          </p>
        </div>
      </div>

      <ProfileSettings user={user} />
    </div>
  );
}
