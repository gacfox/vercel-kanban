import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-slate-500/15 text-slate-700 dark:text-slate-300",
];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function UserAvatar({
  id,
  name,
  className,
  size = "default",
}: {
  id: string;
  name: string;
  className?: string;
  size?: "sm" | "default" | "lg";
}) {
  const color = AVATAR_COLORS[hashString(id) % AVATAR_COLORS.length];
  const sizeClass =
    size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-9 text-sm" : "size-8 text-xs";

  return (
    <Avatar className={cn(sizeClass, className)}>
      <AvatarFallback className={cn("font-medium", color)}>
        {initialsOf(name)}
      </AvatarFallback>
    </Avatar>
  );
}
