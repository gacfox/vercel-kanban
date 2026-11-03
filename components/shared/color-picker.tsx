"use client";

import { cn } from "@/lib/utils";

export function ColorPicker({
  colors,
  value,
  onChange,
}: {
  colors: ReadonlyArray<{ key: string; label: string; hex?: string; dot?: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color.key}
          type="button"
          title={color.label}
          aria-label={color.label}
          onClick={() => onChange(color.key)}
          className={cn(
            "size-7 rounded-full border-2 transition-transform hover:scale-110",
            value === color.key
              ? "border-foreground ring-2 ring-ring ring-offset-1 ring-offset-background"
              : "border-transparent"
          )}
          style={
            color.hex
              ? { backgroundColor: color.hex }
              : { backgroundColor: "currentColor" }
          }
        >
          {color.dot ? <span className={cn("block size-full rounded-full", color.dot)} /> : null}
        </button>
      ))}
    </div>
  );
}
