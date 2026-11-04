"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const THEMES = ["system", "light", "dark"] as const;

type ThemeOption = (typeof THEMES)[number];

const THEME_LABELS: Record<ThemeOption, string> = {
  system: "跟随系统",
  light: "亮色",
  dark: "暗色",
};

function isTheme(value: string | undefined): value is ThemeOption {
  return value === "system" || value === "light" || value === "dark";
}

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme: ThemeOption =
    mounted && isTheme(theme) ? theme : "system";
  const nextTheme =
    THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];

  const CurrentIcon =
    currentTheme === "dark" ? Moon : currentTheme === "light" ? Sun : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextTheme)}
      aria-label={`当前主题：${THEME_LABELS[currentTheme]}，点击切换到${THEME_LABELS[nextTheme]}`}
      title={`当前主题：${THEME_LABELS[currentTheme]}`}
    >
      <CurrentIcon className="size-4" />
    </Button>
  );
}
