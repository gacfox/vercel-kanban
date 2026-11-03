"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";

function parseValue(value: string): Date | null {
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function LocalDate({
  value,
  mode = "datetime",
  relative = false,
  className,
  fallback = "—",
}: {
  value: string | null | undefined;
  mode?: "datetime" | "date" | "time";
  relative?: boolean;
  className?: string;
  fallback?: string;
}) {
  if (!value) return <span className={className}>{fallback}</span>;

  if (mode === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return <span className={className}>{value}</span>;
  }

  const date = parseValue(value);
  if (!date) return <span className={className}>{fallback}</span>;

  if (relative) {
    return (
      <span className={className} title={format(date, "yyyy-MM-dd HH:mm")}>
        {formatDistanceToNow(date, { addSuffix: true, locale: zhCN })}
      </span>
    );
  }

  const pattern =
    mode === "date" ? "yyyy-MM-dd" : mode === "time" ? "HH:mm" : "yyyy-MM-dd HH:mm";

  return (
    <span className={cn(className)} title={date.toISOString()}>
      {format(date, pattern)}
    </span>
  );
}
