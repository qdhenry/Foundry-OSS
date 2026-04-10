export const LOG_LEVEL_BADGE: Record<string, { bg: string; text: string }> = {
  info: { bg: "bg-status-info-bg", text: "text-status-info-fg" },
  stdout: { bg: "bg-surface-raised", text: "text-text-secondary" },
  stderr: { bg: "bg-status-error-bg", text: "text-status-error-fg" },
  system: { bg: "bg-status-info-bg", text: "text-status-info-fg" },
  error: { bg: "bg-status-error-bg", text: "text-status-error-fg" },
};

export function formatLogTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
