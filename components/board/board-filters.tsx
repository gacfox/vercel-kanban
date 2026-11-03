"use client";

import { Filter, Search, X } from "lucide-react";
import { useBoard } from "@/components/board/board-provider";
import { PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DueFilter } from "@/components/board/board-provider";

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function BoardFilters() {
  const { data, filters, setFilters, resetFilters } = useBoard();

  const activeCount =
    (filters.search ? 1 : 0) +
    (filters.assigneeIds.length > 0 ? 1 : 0) +
    (filters.labelIds.length > 0 ? 1 : 0) +
    (filters.priorities.length > 0 ? 1 : 0) +
    (filters.due !== "all" ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) =>
            setFilters((prev) => ({ ...prev, search: event.target.value }))
          }
          placeholder="搜索卡片、标签、负责人"
          className="h-8 pl-8"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Filter className="size-3.5" />
            负责人
            {filters.assigneeIds.length > 0 ? (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {filters.assigneeIds.length}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>负责人</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {data.members.map((member) => (
            <DropdownMenuCheckboxItem
              key={member.user.id}
              checked={filters.assigneeIds.includes(member.user.id)}
              onCheckedChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  assigneeIds: toggleValue(prev.assigneeIds, member.user.id),
                }))
              }
            >
              {member.user.displayName}
            </DropdownMenuCheckboxItem>
          ))}
          {data.members.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">暂无成员</p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            标签
            {filters.labelIds.length > 0 ? (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {filters.labelIds.length}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>标签</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {data.labels.map((label) => (
            <DropdownMenuCheckboxItem
              key={label.id}
              checked={filters.labelIds.includes(label.id)}
              onCheckedChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  labelIds: toggleValue(prev.labelIds, label.id),
                }))
              }
            >
              {label.name}
            </DropdownMenuCheckboxItem>
          ))}
          {data.labels.length === 0 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">暂无标签</p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            优先级
            {filters.priorities.length > 0 ? (
              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                {filters.priorities.length}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>优先级</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITIES.map((priority) => (
            <DropdownMenuCheckboxItem
              key={priority.value}
              checked={filters.priorities.includes(priority.value)}
              onCheckedChange={() =>
                setFilters((prev) => ({
                  ...prev,
                  priorities: toggleValue(prev.priorities, priority.value),
                }))
              }
            >
              {priority.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Select
        value={filters.due}
        onValueChange={(value) =>
          setFilters((prev) => ({ ...prev, due: value as DueFilter }))
        }
      >
        <SelectTrigger size="sm" className="h-8 w-32">
          <SelectValue placeholder="截止时间" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部截止</SelectItem>
          <SelectItem value="overdue">已逾期</SelectItem>
          <SelectItem value="today">今天到期</SelectItem>
          <SelectItem value="week">7 天内</SelectItem>
          <SelectItem value="none">无截止</SelectItem>
        </SelectContent>
      </Select>

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 text-muted-foreground")}
          onClick={resetFilters}
        >
          <X className="size-3.5" />
          清除筛选
        </Button>
      ) : null}

      {activeCount > 0 && data.columns.some((column) => column.hiddenCount > 0) ? (
        <span className="text-[11px] text-muted-foreground">
          历史卡片展开后才会参与筛选
        </span>
      ) : null}
    </div>
  );
}
