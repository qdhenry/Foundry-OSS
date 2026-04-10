"use client";

import { useQuery } from "convex/react";

interface VersionDiffProps {
  versionAId: string;
  versionBId: string;
  onClose: () => void;
}

type DiffLine = {
  type: "same" | "added" | "removed";
  content: string;
  lineA?: number;
  lineB?: number;
};

function computeDiff(textA: string, textB: string): DiffLine[] {
  const linesA = textA.split("\n");
  const linesB = textB.split("\n");
  const result: DiffLine[] = [];

  const _maxLen = Math.max(linesA.length, linesB.length);
  let lineNumA = 1;
  let lineNumB = 1;

  // Simple line-by-line comparison
  let i = 0;
  let j = 0;
  while (i < linesA.length || j < linesB.length) {
    if (i >= linesA.length) {
      result.push({ type: "added", content: linesB[j], lineB: lineNumB++ });
      j++;
    } else if (j >= linesB.length) {
      result.push({ type: "removed", content: linesA[i], lineA: lineNumA++ });
      i++;
    } else if (linesA[i] === linesB[j]) {
      result.push({ type: "same", content: linesA[i], lineA: lineNumA++, lineB: lineNumB++ });
      i++;
      j++;
    } else {
      // Look ahead to find matching line
      let foundInB = -1;
      for (let k = j + 1; k < Math.min(j + 5, linesB.length); k++) {
        if (linesA[i] === linesB[k]) {
          foundInB = k;
          break;
        }
      }

      let foundInA = -1;
      for (let k = i + 1; k < Math.min(i + 5, linesA.length); k++) {
        if (linesA[k] === linesB[j]) {
          foundInA = k;
          break;
        }
      }

      if (foundInB !== -1 && (foundInA === -1 || foundInB - j <= foundInA - i)) {
        // Lines were added in B
        while (j < foundInB) {
          result.push({ type: "added", content: linesB[j], lineB: lineNumB++ });
          j++;
        }
      } else if (foundInA !== -1) {
        // Lines were removed from A
        while (i < foundInA) {
          result.push({ type: "removed", content: linesA[i], lineA: lineNumA++ });
          i++;
        }
      } else {
        // Changed line
        result.push({ type: "removed", content: linesA[i], lineA: lineNumA++ });
        result.push({ type: "added", content: linesB[j], lineB: lineNumB++ });
        i++;
        j++;
      }
    }
  }

  return result;
}

const LINE_STYLES = {
  same: "bg-transparent",
  added: "bg-status-success-bg",
  removed: "bg-status-error-bg",
};

const LINE_NUMBER_STYLES = {
  same: "text-text-muted",
  added: "text-status-success-fg",
  removed: "text-status-error-fg",
};

export function VersionDiff({ versionAId, versionBId, onClose }: VersionDiffProps) {
  const comparison = useQuery(
    "skillVersions:compare" as any,
    versionAId && versionBId
      ? { versionAId: versionAId as any, versionBId: versionBId as any }
      : "skip",
  );

  if (comparison === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-muted">Loading comparison...</p>
      </div>
    );
  }

  const { versionA, versionB } = comparison;
  const diffLines = computeDiff(versionA.content, versionB.content);

  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;

  return (
    <div className="flex flex-col rounded-xl border border-border-default bg-surface-default">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-heading">Version Diff</h3>
          <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text-secondary">
            {versionA.version}
          </span>
          <span className="text-xs text-text-muted">&rarr;</span>
          <span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text-secondary">
            {versionB.version}
          </span>
          <span className="text-xs font-medium text-status-success-fg">+{addedCount}</span>
          <span className="text-xs font-medium text-status-error-fg">-{removedCount}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Diff content */}
      <div className="max-h-[600px] overflow-auto">
        <div className="min-w-0">
          {diffLines.map((line, idx) => (
            <div key={idx} className={`flex font-mono text-xs leading-6 ${LINE_STYLES[line.type]}`}>
              {/* Line number A */}
              <span
                className={`w-10 shrink-0 border-r border-border-default px-2 text-right ${LINE_NUMBER_STYLES[line.type]}`}
              >
                {line.lineA ?? ""}
              </span>
              {/* Line number B */}
              <span
                className={`w-10 shrink-0 border-r border-border-default px-2 text-right ${LINE_NUMBER_STYLES[line.type]}`}
              >
                {line.lineB ?? ""}
              </span>
              {/* Change marker */}
              <span className={`w-6 shrink-0 text-center ${LINE_NUMBER_STYLES[line.type]}`}>
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              </span>
              {/* Content */}
              <span className="flex-1 whitespace-pre-wrap break-all px-2 text-text-heading">
                {line.content}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
