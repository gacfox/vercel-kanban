"use client";

import { Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { UserSummary } from "@/lib/types";

export function AssigneePicker({
  members,
  selectedIds,
  onChange,
  disabled,
}: {
  members: UserSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const selected = members.filter((member) => selectedIds.includes(member.id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-9 w-full justify-start gap-1.5 py-1.5 font-normal"
          disabled={disabled}
        >
          <Users className="size-4 shrink-0 text-muted-foreground" />
          {selected.length === 0 ? (
            <span className="text-muted-foreground">添加负责人</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              {selected.map((member) => (
                <span key={member.id} className="flex items-center gap-1 text-xs">
                  <UserAvatar id={member.id} name={member.displayName} size="sm" />
                  {member.displayName}
                </span>
              ))}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        {members.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">暂无项目成员</p>
        ) : (
          members.map((member) => {
            const checked = selectedIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== member.id)
                      : [...selectedIds, member.id]
                  )
                }
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border",
                    checked && "bg-primary text-primary-foreground"
                  )}
                >
                  {checked ? <Check className="size-3" /> : null}
                </span>
                <UserAvatar id={member.id} name={member.displayName} size="sm" />
                <span className="truncate">{member.displayName}</span>
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
