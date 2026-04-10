"use client";

import { GoogleDriveImportButton } from "@foundry/ui/google-drive";
import { useMutation } from "convex/react";
import { type DragEvent, useCallback, useMemo, useRef, useState } from "react";
import {
  type FileCategory,
  type FileUploadStatus,
  type ManagedFile,
  useUploadQueue,
} from "@/hooks/useUploadQueue";

// ---------------------------------------------------------------------------
// Backwards-compat re-export
// ---------------------------------------------------------------------------

export interface UploadedFile {
  file: File;
  category: FileCategory;
}

export interface UploadStepResult {
  documentIdsToQueue: string[];
  alreadyQueuedDocumentIds: string[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DocumentUploadStepProps {
  programId: string | null;
  orgId: string;
  onNext: (result: UploadStepResult) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_TYPES = ".pdf,.docx,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg";

const CATEGORY_LABELS: Record<FileCategory, string> = {
  requirements: "Requirements",
  architecture: "Architecture",
  meeting_notes: "Meeting Notes",
  testing: "Testing",
  deployment: "Deployment",
  other: "Other",
};

const CATEGORY_COLORS: Record<FileCategory, string> = {
  requirements: "bg-status-info-bg text-accent-default",
  architecture: "bg-status-success-bg text-status-success-fg",
  meeting_notes: "bg-status-warning-bg text-status-warning-fg",
  testing: "bg-status-success-bg text-status-success-fg",
  deployment: "bg-status-warning-bg text-status-warning-fg",
  other: "bg-surface-elevated text-text-primary",
};

const STATUS_BADGES: Record<FileUploadStatus, { label: string; classes: string }> = {
  queued: {
    label: "Queued",
    classes: "bg-surface-elevated text-text-secondary",
  },
  getting_url: {
    label: "Preparing",
    classes: "bg-status-warning-bg text-status-warning-fg",
  },
  uploading: {
    label: "Uploading",
    classes: "bg-status-info-bg text-accent-default",
  },
  saving: {
    label: "Saving",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  done: {
    label: "Done",
    classes: "bg-status-success-bg text-status-success-fg",
  },
  failed: {
    label: "Failed",
    classes: "bg-status-error-bg text-status-error-fg",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentUploadStep({ programId, orgId, onNext, onBack }: DocumentUploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [driveDocumentIds, setDriveDocumentIds] = useState<string[]>([]);
  const [isDriveImporting, setIsDriveImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convex mutations
  const generateUploadUrl = useMutation("documents:generateUploadUrl" as any) as (args: {
    orgId: string;
  }) => Promise<string>;
  const saveDocumentMutation = useMutation("documents:save" as any) as (
    args: Record<string, unknown>,
  ) => Promise<string>;

  // Upload queue
  const queue = useUploadQueue({
    orgId,
    programId: programId ?? "",
    generateUploadUrl: async (args) => generateUploadUrl(args),
    saveDocument: async (args) => {
      if (!programId) {
        throw new Error("Program not found");
      }

      const docId = await saveDocumentMutation({
        ...args,
        programId: programId as any, // Convex ID type
        storageId: args.storageId as any, // Convex ID type
      });
      return docId as string;
    },
  });

  // Derived counts
  const doneCount = useMemo(
    () => queue.files.filter((f) => f.status === "done").length,
    [queue.files],
  );
  const failedCount = useMemo(
    () => queue.files.filter((f) => f.status === "failed").length,
    [queue.files],
  );
  const nextStepResult = useMemo<UploadStepResult>(
    () => ({
      documentIdsToQueue: queue.completedDocumentIds,
      alreadyQueuedDocumentIds: driveDocumentIds,
    }),
    [queue.completedDocumentIds, driveDocumentIds],
  );
  const hasAnyImports = queue.files.length > 0 || driveDocumentIds.length > 0 || isDriveImporting;
  const isAnyImportRunning = queue.isUploading || isDriveImporting;
  const canProceed =
    !isAnyImportRunning &&
    (driveDocumentIds.length > 0 || (queue.files.length > 0 && queue.allDone));

  // ---------- Drag & drop handlers ----------

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        queue.addFiles(e.dataTransfer.files);
      }
    },
    [queue],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        queue.addFiles(e.target.files);
        e.target.value = "";
      }
    },
    [queue],
  );

  // ---------- Back button with confirmation ----------

  const handleBack = useCallback(() => {
    if (isAnyImportRunning) {
      const confirmed = confirm("Uploads in progress. Leave anyway?");
      if (!confirmed) return;
    }
    onBack();
  }, [isAnyImportRunning, onBack]);

  // ---------- Render ----------

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <h2 className="mb-1 text-lg font-semibold text-text-heading">Upload Documents</h2>
      <p className="mb-6 text-sm text-text-secondary">
        Upload project documents for AI-powered analysis. Gap analyses, architecture docs, meeting
        notes, and more.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-accent-default bg-status-warning-bg"
            : "border-border-default hover:border-text-muted"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleInputChange}
        />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated">
          <svg
            className="h-6 w-6 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-primary">
          {isDragging ? "Drop files here" : "Drag and drop files, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-text-secondary">PDF, DOCX, XLSX, CSV, TXT, MD, PNG, JPG</p>
      </div>

      {/* Google Drive import option */}
      {programId && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-border-default" />
          <span className="text-xs text-text-muted">or</span>
          <div className="h-px flex-1 bg-border-default" />
        </div>
      )}
      {programId && (
        <div className="mt-3 flex justify-center">
          <GoogleDriveImportButton
            orgId={orgId}
            programId={programId}
            onImportComplete={(documentIds) => {
              setDriveDocumentIds((current) => {
                const nextIds = new Set(current);
                for (const documentId of documentIds) {
                  nextIds.add(documentId);
                }
                return Array.from(nextIds);
              });
            }}
            onImportingChange={setIsDriveImporting}
          />
        </div>
      )}

      {/* Summary bar + file list */}
      {queue.files.length > 0 && (
        <div className="mt-4">
          {/* Summary bar */}
          <div className="mb-3 flex items-center justify-between text-sm text-text-secondary">
            <span>{queue.files.length} files</span>
            <div className="flex gap-3">
              {doneCount > 0 && (
                <span className="text-status-success-fg">{doneCount} uploaded</span>
              )}
              {failedCount > 0 && (
                <>
                  <span className="text-status-error-fg">{failedCount} failed</span>
                  {failedCount > 1 && (
                    <button
                      onClick={queue.retryAllFailed}
                      className="text-accent-default hover:text-accent-strong font-medium"
                    >
                      Retry all
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* File rows */}
          <div className="space-y-2">
            {queue.files.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                onRemove={() => queue.removeFile(item.id)}
                onRetry={() => queue.retryFile(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover"
        >
          Back
        </button>
        <div className="flex gap-3">
          {!hasAnyImports && (
            <button
              type="button"
              onClick={() =>
                onNext({
                  documentIdsToQueue: [],
                  alreadyQueuedDocumentIds: [],
                })
              }
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover"
            >
              Skip
            </button>
          )}
          {hasAnyImports && isAnyImportRunning && (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand opacity-60 cursor-not-allowed"
            >
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Uploading...
            </button>
          )}
          {hasAnyImports && canProceed && (
            <button
              type="button"
              onClick={() => onNext(nextStepResult)}
              className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-accent-strong"
            >
              Next
            </button>
          )}
          {hasAnyImports && !isAnyImportRunning && !canProceed && (
            <button
              type="button"
              disabled
              title={`${failedCount} file(s) failed to upload`}
              className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand opacity-60 cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileRow sub-component
// ---------------------------------------------------------------------------

function FileRow({
  item,
  onRemove,
  onRetry,
}: {
  item: ManagedFile;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const badge = STATUS_BADGES[item.status];
  const isActive =
    item.status === "getting_url" || item.status === "uploading" || item.status === "saving";

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* File icon */}
          <svg
            className="h-4 w-4 shrink-0 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-heading">{item.file.name}</p>
            <p className="text-xs text-text-secondary">{formatFileSize(item.file.size)}</p>
          </div>
          {/* Category badge */}
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[item.category]}`}
          >
            {CATEGORY_LABELS[item.category]}
          </span>
          {/* Status badge */}
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.classes}`}
            data-testid="status-badge"
          >
            {badge.label}
          </span>
        </div>

        {/* Actions */}
        <div className="ml-2 flex shrink-0 items-center gap-1">
          {item.status === "done" && (
            <span className="rounded-lg p-1 text-status-success-fg">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          {item.status === "failed" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              aria-label="Retry upload"
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          )}
          {(item.status === "queued" || item.status === "failed" || isActive) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label="Remove file"
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar — only during uploading */}
      {item.status === "uploading" && (
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-elevated">
            <div
              className="h-1.5 rounded-full bg-accent-default transition-all duration-150"
              style={{ width: `${item.progress}%` }}
              data-testid="progress-bar-fill"
            />
          </div>
          <span className="text-xs tabular-nums text-text-secondary">{item.progress}%</span>
        </div>
      )}

      {/* Error message — only during failed */}
      {item.status === "failed" && item.error && (
        <p className="mt-1 text-xs text-status-error-fg">Error: {item.error}</p>
      )}
    </div>
  );
}
