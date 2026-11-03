import {
  ArrowDown,
  ArrowUp,
  Equal,
  Flame,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { PRIORITY_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  minus: Minus,
  "arrow-down": ArrowDown,
  equal: Equal,
  "arrow-up": ArrowUp,
  flame: Flame,
};

export function PriorityIcon({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_MAP[priority];
  const Icon = ICONS[meta.icon] ?? Minus;
  return <Icon className={cn(meta.className, className)} aria-hidden />;
}
