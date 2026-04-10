"use client";

import { Moon01, Sun } from "@untitledui/icons";
import { useTheme } from "../theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="rounded-lg p-2 text-text-muted hover:bg-interactive-hover hover:text-accent-default"
    >
      {isDark ? <Sun size={20} /> : <Moon01 size={20} />}
    </button>
  );
}
