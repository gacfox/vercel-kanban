"use client";

import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { zhCN } from "react-day-picker/locale";
import { formatLocalDate, parseLocalDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MIN_MONTH = new Date(2000, 0);
const MAX_MONTH = new Date(2100, 11);

export function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "选择日期",
  clearable = true,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = parseLocalDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          aria-label={ariaLabel}
          className={cn(
            "min-w-0 w-full justify-start gap-2 px-2.5 text-left font-normal data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selected ? formatLocalDate(selected) : placeholder}
          </span>
          <ChevronDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto gap-0 overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          locale={zhCN}
          captionLayout="dropdown"
          startMonth={MIN_MONTH}
          endMonth={MAX_MONTH}
          autoFocus
          onSelect={(date) => {
            onChange(date ? formatLocalDate(date) : null);
            setOpen(false);
          }}
        />
        {clearable && selected ? (
          <div className="border-t p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              清除
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
