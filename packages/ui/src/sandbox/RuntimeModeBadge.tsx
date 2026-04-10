"use client";

type RuntimeMode = "idle" | "executing" | "interactive" | "hibernating" | string;

interface RuntimeModeBadgeProps {
  mode?: RuntimeMode | null;
  className?: string;
}

const MODE_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  idle: {
    label: "Idle",
    badgeClass: "border-border-default bg-surface-raised text-text-secondary",
  },
  executing: {
    label: "Executing",
    badgeClass: "badge-info",
  },
  interactive: {
    label: "Interactive",
    badgeClass: "border-border-accent bg-interactive-subtle text-accent-default",
  },
  hibernating: {
    label: "Hibernating",
    badgeClass: "badge-warning",
  },
};

function formatModeLabel(mode: string) {
  if (!mode) return "Unknown";
  return mode
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RuntimeModeBadge({ mode, className }: RuntimeModeBadgeProps) {
  if (typeof mode !== "string") return null;
  const normalizedMode = mode.trim();
  if (!normalizedMode) return null;
  const config = MODE_CONFIG[normalizedMode] ?? {
    label: formatModeLabel(normalizedMode),
    badgeClass: "border-border-default bg-surface-raised text-text-secondary",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config.badgeClass} ${className ?? ""}`.trim()}
    >
      {config.label}
    </span>
  );
}
