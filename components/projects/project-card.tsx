import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ColorDot } from "@/components/shared/color-dot";
import { LocalDate } from "@/components/shared/local-date";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ROLE_BADGE_VARIANT, ROLE_LABELS } from "@/lib/constants";
import type { ProjectSummary } from "@/lib/types";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const archived = Boolean(project.archivedAt);

  return (
    <Link href={`/projects/${project.id}`} className="group block">
      <Card
        className={cn(
          "h-full transition-colors group-hover:border-foreground/20",
          archived && "opacity-60"
        )}
      >
        <CardHeader className="gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ColorDot color={project.color} />
              <CardTitle className="truncate text-base">{project.name}</CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {archived ? <Badge variant="outline">已归档</Badge> : null}
              <Badge variant={ROLE_BADGE_VARIANT[project.role]}>
                {project.isAdmin ? "管理员" : ROLE_LABELS[project.role]}
              </Badge>
            </div>
          </div>
          {project.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {project.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">暂无描述</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{project.totalCards} 张卡片</span>
            <span>{project.doneCards} 已完成</span>
            {project.overdueCards > 0 ? (
              <span className="text-red-600 dark:text-red-400">
                {project.overdueCards} 逾期
              </span>
            ) : null}
            {project.dueSoonCards > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {project.dueSoonCards} 即将到期
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center -space-x-2">
              {project.members.slice(0, 5).map((member) => (
                <UserAvatar
                  key={member.id}
                  id={member.id}
                  name={member.displayName}
                  size="sm"
                  className="ring-2 ring-background"
                />
              ))}
              {project.members.length > 5 ? (
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-background">
                  +{project.members.length - 5}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              更新于 <LocalDate value={project.updatedAt} relative />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
