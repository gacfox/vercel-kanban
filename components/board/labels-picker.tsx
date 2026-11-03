"use client";

import { Check, Tag } from "lucide-react";
import { LABEL_COLOR_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Label } from "@/lib/types";

export function LabelsPicker({
  labels,
  selectedIds,
  onChange,
  disabled,
}: {
  labels: Label[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const selected = labels.filter((label) => selectedIds.includes(label.id));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-9 w-full justify-start gap-1.5 py-1.5 font-normal"
          disabled={disabled}
        >
          <Tag className="size-4 shrink-0 text-muted-foreground" />
          {selected.length === 0 ? (
            <span className="text-muted-foreground">添加标签</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {selected.map((label) => {
                const color = LABEL_COLOR_MAP[label.color] ?? LABEL_COLOR_MAP.slate;
                return (
                  <span
                    key={label.id}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium",
                      color.className
                    )}
                  >
                    {label.name}
                  </span>
                );
              })}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-1">
        {labels.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            项目还没有标签，请先在项目设置中创建。
          </p>
        ) : (
          labels.map((label) => {
            const checked = selectedIds.includes(label.id);
            return (
              <button
                key={label.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() =>
                  onChange(
                    checked
                      ? selectedIds.filter((id) => id !== label.id)
                      : [...selectedIds, label.id]
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
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-medium",
                    (LABEL_COLOR_MAP[label.color] ?? LABEL_COLOR_MAP.slate).className
                  )}
                >
                  {label.name}
                </span>
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
