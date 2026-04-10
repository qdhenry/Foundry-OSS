"use client";

import { XClose } from "@untitledui/icons";
import { useQuery } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";

interface VersionDiffModalProps {
  versionIdA: string;
  versionIdB: string;
  onClose: () => void;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumber: number;
}

function computeDiff(contentA: string, contentB: string): DiffLine[] {
  const linesA = contentA.split("\n");
  const linesB = contentB.split("\n");
  const result: DiffLine[] = [];
  const maxLen = Math.max(linesA.length, linesB.length);

  // Simple line-by-line comparison (not a full diff algorithm, but sufficient for version diffs)
  let lineNum = 0;
  for (let i = 0; i < maxLen; i++) {
    lineNum++;
    const a = linesA[i];
    const b = linesB[i];

    if (a === undefined && b !== undefined) {
      result.push({ type: "added", content: b, lineNumber: lineNum });
    } else if (a !== undefined && b === undefined) {
      result.push({ type: "removed", content: a, lineNumber: lineNum });
    } else if (a !== b) {
      result.push({
        type: "removed",
        content: a ?? "",
        lineNumber: lineNum,
      });
      result.push({ type: "added", content: b ?? "", lineNumber: lineNum });
    } else {
      result.push({
        type: "unchanged",
        content: a ?? "",
        lineNumber: lineNum,
      });
    }
  }

  return result;
}

const DIFF_COLORS = {
  added: "bg-status-success-bg text-status-success-fg",
  removed: "bg-status-error-bg text-status-error-fg",
  unchanged: "",
};

const DIFF_PREFIX = {
  added: "+",
  removed: "-",
  unchanged: " ",
};

export function VersionDiffModal({ versionIdA, versionIdB, onClose }: VersionDiffModalProps) {
  const data = useQuery("skillVersionAnalytics:getVersionContent" as any, {
    versionIdA,
    versionIdB,
  }) as
    | {
        a: { version: string; content: string };
        b: { version: string; content: string };
      }
    | undefined;

  const diff = useMemo(() => {
    if (!data) return [];
    return computeDiff(data.a.content, data.b.content);
  }, [data]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border-default bg-surface-default shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-heading">Version Diff</h3>
            {data && (
              <span className="text-xs text-text-muted">
                {data.a.version} &rarr; {data.b.version}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-primary"
          >
            <XClose size={16} />
          </button>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-y-auto">
          {!data ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-blue-500 border-t-transparent" />
            </div>
          ) : (
            <pre className="text-xs leading-5">
              {diff.map((line, i) => (
                <div key={`diff-${i}`} className={`flex px-4 ${DIFF_COLORS[line.type]}`}>
                  <span className="w-8 shrink-0 select-none text-right text-text-muted opacity-50">
                    {line.lineNumber}
                  </span>
                  <span className="w-4 shrink-0 select-none text-center">
                    {DIFF_PREFIX[line.type]}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
                </div>
              ))}
            </pre>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="border-t border-border-default bg-surface-raised px-4 py-2">
            <span className="text-xs text-text-muted">
              {diff.filter((l) => l.type === "added").length} additions,{" "}
              {diff.filter((l) => l.type === "removed").length} removals
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
