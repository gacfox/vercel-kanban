"use client";

import * as React from "react";
import {
  combineLocalDateTime,
  formatLocalDate,
  parseLocalDate,
  splitDateTimeLocal,
} from "@/lib/date";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/shared/date-picker";
import { Input } from "@/components/ui/input";

const DEFAULT_TIME = "09:00";

export function DateTimePicker({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { date, time } = splitDateTimeLocal(value);
  const [timeDraft, setTimeDraft] = React.useState(time);

  React.useEffect(() => {
    setTimeDraft(time);
  }, [time]);

  function commitTime(next: string) {
    if (!date) return;
    onChange(combineLocalDateTime(date, next));
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DatePicker
        value={date ? formatLocalDate(date) : null}
        onChange={(next) => {
          if (!next) {
            onChange(null);
            return;
          }
          onChange(
            combineLocalDateTime(parseLocalDate(next), time || DEFAULT_TIME)
          );
        }}
        disabled={disabled}
        aria-label={date ? `截止日期：${formatLocalDate(date)}` : "截止日期"}
        className="flex-1"
      />
      <Input
        type="time"
        aria-label="截止时间"
        value={timeDraft}
        disabled={disabled || !date}
        onChange={(event) => {
          const next = event.target.value;
          setTimeDraft(next);
          if (next) commitTime(next);
        }}
        onBlur={() => {
          if (!timeDraft) setTimeDraft(time || DEFAULT_TIME);
        }}
        className="w-28 shrink-0 appearance-none bg-background px-2 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  );
}
