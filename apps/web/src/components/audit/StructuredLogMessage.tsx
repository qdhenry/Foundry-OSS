"use client";

import { useState } from "react";
import type { ParsedLogMessage } from "./parseLogMessage";

const BADGE_COLORS: Record<string, string> = {
  user: "bg-status-success-bg text-status-success-fg",
  assistant: "bg-status-info-bg text-accent-default",
  system: "bg-sky-100 text-sky-700",
  tool_result: "bg-status-warning-bg text-status-warning-fg",
  text: "bg-surface-raised text-text-secondary",
  "Session Init": "bg-sky-100 text-sky-700",
  Result: "bg-status-success-bg text-status-success-fg",
};

function FieldValue({ value, type }: { value: string; type: string }) {
  const [showFull, setShowFull] = useState(false);

  if (type === "badge") {
    const colors = BADGE_COLORS[value] ?? "bg-surface-raised text-text-secondary";
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${colors}`}>
        {value}
      </span>
    );
  }

  if (type === "file") {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-xs text-accent-default">
        <svg
          className="h-3 w-3 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {value}
      </span>
    );
  }

  if (type === "code") {
    const isLong = value.length > 200;
    const display = isLong && !showFull ? `${value.slice(0, 200)}...` : value;
    return (
      <div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface-raised px-2 py-1 font-mono text-xs text-text-primary">
          {display}
        </pre>
        {isLong && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFull(!showFull);
            }}
            className="mt-0.5 text-[10px] font-medium text-accent-default hover:text-accent-strong"
          >
            {showFull ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    );
  }

  // text type
  const isLong = value.length > 200;
  const display = isLong && !showFull ? `${value.slice(0, 200)}...` : value;
  return (
    <span>
      <span className="text-xs text-text-primary">{display}</span>
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(!showFull);
          }}
          className="ml-1 text-[10px] font-medium text-accent-default hover:text-accent-strong"
        >
          {showFull ? "less" : "more"}
        </button>
      )}
    </span>
  );
}

interface StructuredLogMessageProps {
  parsed: ParsedLogMessage;
}

export function StructuredLogMessage({ parsed }: StructuredLogMessageProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-w-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-left"
      >
        <svg
          className={`h-3 w-3 shrink-0 text-text-muted transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm text-text-primary">{parsed.summary}</span>
        <span className="shrink-0 rounded bg-status-info-bg px-1 py-0.5 text-[9px] font-medium text-status-info-fg">
          structured
        </span>
      </button>

      {expanded && (
        <div className="ml-4 mt-1.5 space-y-1 border-l-2 border-border-default pl-3">
          {parsed.fields.map((field, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="shrink-0 pt-0.5 text-right text-[11px] font-medium text-text-secondary"
                style={{ minWidth: "5rem" }}
              >
                {field.key}
              </span>
              <FieldValue value={field.value} type={field.type} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
