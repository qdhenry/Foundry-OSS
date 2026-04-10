"use client";

import { AuditEntry, type AuditEntryData } from "./AuditEntry";

type Action = "create" | "update" | "delete" | "status_change";

const DOT_COLOR: Record<Action, string> = {
  create: "bg-green-500",
  update: "bg-blue-500",
  delete: "bg-red-500",
  status_change: "bg-amber-500",
};

/** Get a display label for a date group. */
function getDateLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;

  if (timestamp >= startOfToday) return "Today";
  if (timestamp >= startOfYesterday) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/** Get a date key (YYYY-MM-DD) for grouping. */
function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface AuditTimelineProps {
  entries: AuditEntryData[];
}

export function AuditTimeline({ entries }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-default px-6 py-16 text-center">
        <svg
          className="mx-auto mb-3 h-10 w-10 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"
          />
        </svg>
        <p className="text-sm font-medium text-text-secondary">No audit entries found</p>
        <p className="mt-1 text-xs text-text-muted">
          Activity will appear here as changes are made to this program.
        </p>
      </div>
    );
  }

  // Group entries by date
  const groups: { key: string; label: string; entries: AuditEntryData[] }[] = [];
  let currentKey = "";

  for (const entry of entries) {
    const key = getDateKey(entry.timestamp);
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ key, label: getDateLabel(entry.timestamp), entries: [] });
    }
    groups[groups.length - 1].entries.push(entry);
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Sticky date header */}
          <div className="sticky top-0 z-10 mb-2">
            <span className="inline-flex rounded-full bg-surface-raised px-3 py-1 text-xs font-semibold text-text-secondary">
              {group.label}
            </span>
          </div>

          {/* Timeline entries */}
          <div className="relative ml-3">
            {/* Vertical timeline line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border-default" />

            <div className="space-y-0.5">
              {group.entries.map((entry) => (
                <div key={entry._id} className="relative flex items-start">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-4 z-10 h-2 w-2 -translate-x-[3.5px] rounded-full ring-2 ring-surface-default ${DOT_COLOR[entry.action]}`}
                  />

                  {/* Entry content */}
                  <div className="ml-4 flex-1">
                    <AuditEntry entry={entry} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
