"use client";

import { useCallback, useEffect } from "react";

interface Duplicate {
  driveFileId: string;
  fileName: string;
  importedAt: number;
}

interface DuplicateImportDialogProps {
  isOpen: boolean;
  duplicates: Duplicate[];
  onConfirm: () => void;
  onCancel: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DuplicateImportDialog({
  isOpen,
  duplicates,
  onConfirm,
  onCancel,
}: DuplicateImportDialogProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const isSingle = duplicates.length === 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-default p-6 shadow-xl">
        <h3 className="text-base font-semibold text-text-heading">
          {isSingle ? "File already imported" : "Files already imported"}
        </h3>
        <p className="mt-2 text-sm text-text-secondary">
          {isSingle
            ? "This file has already been imported into this program."
            : `${duplicates.length} of the selected files have already been imported.`}
        </p>

        <ul className="mt-3 space-y-1.5">
          {duplicates.map((d) => (
            <li
              key={d.driveFileId}
              className="flex items-start justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2 text-xs"
            >
              <span className="truncate font-medium text-text-heading">{d.fileName}</span>
              <span className="shrink-0 text-text-secondary">{formatDate(d.importedAt)}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-sm text-text-secondary">Import again?</p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-accent-strong"
          >
            Import anyway
          </button>
        </div>
      </div>
    </div>
  );
}
