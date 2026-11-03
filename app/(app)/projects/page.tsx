import Link from "next/link";
import { connection } from "next/server";
import { CalendarClock, FolderKanban, ListTodo } from "lucide-react";
import { requireUserPage } from "@/lib/auth/guards";
import { getMyTasks, getProjectsForUser } from "@/lib/db/queries/projects";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { ColorDot } from "@/components/shared/color-dot";
import { LocalDate } from "@/components/shared/local-date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PRIORITY_MAP } from "@/lib/constants";

export const instant = false;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  await connection();
  const user = await requireUserPage();
  const [{ archived }, projects, tasks] = await Promise.all([
    searchParams,
    getProjectsForUser(user),
    getMyTasks(user.id),
  ]);

  const showArchived = archived === "1";
  const visibleProjects = showArchived
    ? projects
    : projects.filter((project) => !project.archivedAt);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">项目</h1>
          <p className="text-sm text-muted-foreground">
            管理你的看板、任务和团队成员。
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListTodo className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">我的待办</h2>
          <Badge variant="secondary">{tasks.length}</Badge>
        </div>
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            暂无待办，享受一下。
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {tasks.map((task) => (
              <Link
                key={task.cardId}
                href={`/projects/${task.projectId}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
              >
                <ColorDot color={task.projectColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {task.projectName} · {task.columnTitle}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {task.dueAt ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      <LocalDate value={task.dueAt} mode="date" />
                    </span>
                  ) : null}
                  <span
                    className={`text-xs ${PRIORITY_MAP[task.priority].className}`}
                  >
                    {PRIORITY_MAP[task.priority].label}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FolderKanban className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">
              {showArchived ? "全部项目（含已归档）" : "全部项目"}
            </h2>
            <Badge variant="secondary">{visibleProjects.length}</Badge>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href={showArchived ? "/projects" : "/projects?archived=1"}>
              {showArchived ? "隐藏已归档" : "显示已归档"}
            </Link>
          </Button>
        </div>

        {visibleProjects.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderKanban />
              </EmptyMedia>
              <EmptyTitle>还没有项目</EmptyTitle>
              <EmptyDescription>
                创建一个项目，开始管理你的任务和团队。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <CreateProjectDialog />
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
