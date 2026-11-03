import { PROJECT_COLOR_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ColorDot({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  const meta = PROJECT_COLOR_MAP[color] ?? PROJECT_COLOR_MAP.blue;
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: meta.hex }}
      aria-hidden
    />
  );
}
