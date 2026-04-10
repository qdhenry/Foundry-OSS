"use client";

import { useMutation } from "convex/react";
import { type DragEvent, useCallback, useRef, useState } from "react";
import { type DesignUploadStatus, useDesignUploadQueue } from "./useDesignUploadQueue";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp4",
  "mov",
  "webm",
  "json",
  "css",
  "scss",
  "md",
  "pdf",
]);

const ACCEPT_ATTR = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".mp4",
  ".mov",
  ".webm",
  ".json",
  ".css",
  ".scss",
  ".md",
  ".pdf",
].join(",");

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFiles(fileList: FileList): { errors: string[]; validFiles: File[] } {
  const errors: string[] = [];
  const validFiles: File[] = [];

  for (const file of Array.from(fileList)) {
    const ext = getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      errors.push(`${file.name}: unsupported type .${ext || "unknown"}`);
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}: exceeds 100 MB (${formatFileSize(file.size)})`);
      continue;
    }
    validFiles.push(file);
  }

  return { errors, validFiles };
}

// ---------------------------------------------------------------------------
// Status display maps
// ---------------------------------------------------------------------------

const UPLOAD_STATUS_LABEL: Record<DesignUploadStatus, string> = {
  queued: "Queued",
  getting_url: "Preparing",
  uploading: "Uploading",
  saving: "Saving",
  done: "Done",
  failed: "Failed",
};

const UPLOAD_STATUS_BADGE: Record<DesignUploadStatus, string> = {
  queued: "bg-surface-elevated text-text-secondary",
  getting_url: "bg-status-info-bg text-status-info-fg",
  uploading: "bg-status-info-bg text-status-info-fg",
  saving: "bg-status-info-bg text-status-info-fg",
  done: "bg-status-success-bg text-status-success-fg",
  failed: "bg-status-error-bg text-status-error-fg",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DesignUploadZoneProps {
  orgId: string;
  programId: string;
  workstreamId?: string;
  requirementId?: string;
}

export function DesignUploadZone({
  orgId,
  programId,
  workstreamId,
  requirementId,
}: DesignUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  const generateUploadUrl = useMutation("designAssets:generateUploadUrl" as any);
  const createAsset = useMutation("designAssets:create" as any);

  const queue = useDesignUploadQueue({
    orgId,
    programId,
    workstreamId,
    requirementId,
    generateUploadUrl: async (args) => generateUploadUrl(args) as Promise<string>,
    saveAsset: async ({
      orgId: o,
      programId: p,
      fileId,
      fileName,
      mimeType,
      sizeBytes,
      type,
      content,
      workstreamId: wsId,
      requirementId: reqId,
    }) => {
      const id = await createAsset({
        orgId: o,
        programId: p,
        name: fileName,
        type,
        fileId,
        mimeType,
        sizeBytes,
        content,
        ...(wsId ? { workstreamId: wsId } : {}),
        ...(reqId ? { requirementId: reqId } : {}),
      });
      return id as string;
    },
  });

  const enqueueFiles = useCallback(
    (fileList: FileList) => {
      const { errors, validFiles } = validateFiles(fileList);
      setLocalErrors(errors);
      if (validFiles.length === 0) return;

      const transfer = new DataTransfer();
      for (const file of validFiles) {
        transfer.items.add(file);
      }
      queue.addFiles(transfer.files);
    },
    [queue],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files.length > 0) {
        enqueueFiles(event.dataTransfer.files);
      }
    },
    [enqueueFiles],
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={`cursor-pointer rounded-xl border-2 border-dashed py-10 text-center transition-colors ${
          isDragging
            ? "border-accent-default bg-status-info-bg"
            : "border-border-default hover:border-text-muted"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={ACCEPT_ATTR}
          onChange={(event) => {
            if (!event.target.files) return;
            enqueueFiles(event.target.files);
            event.target.value = "";
          }}
        />

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
            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
          />
        </svg>

        <p className="text-sm font-medium text-text-primary">
          Drag and drop design assets, or click to browse
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          PNG, JPG, WebP, GIF, MP4, MOV, JSON, CSS, SCSS, MD, PDF · up to 100 MB each
        </p>
      </div>

      {/* Validation errors */}
      {localErrors.length > 0 && (
        <div className="rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium">Upload validation issues</span>
            <button
              type="button"
              onClick={() => setLocalErrors([])}
              className="text-status-error-fg underline-offset-2 hover:underline"
            >
              Clear
            </button>
          </div>
          <ul className="space-y-0.5">
            {localErrors.map((error) => (
              <li key={error}>- {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload progress list */}
      {queue.files.length > 0 && (
        <div className="space-y-2">
          {queue.files.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border-default bg-surface-raised px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-heading">{item.file.name}</p>
                  <p className="text-xs text-text-secondary">{formatFileSize(item.file.size)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${UPLOAD_STATUS_BADGE[item.status]}`}
                  >
                    {UPLOAD_STATUS_LABEL[item.status]}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      queue.removeFile(item.id);
                    }}
                    className="text-text-muted hover:text-text-primary"
                    aria-label="Remove"
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
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.status === "failed" ? "bg-red-500" : "bg-accent-default"
                  }`}
                  style={{
                    width: `${item.status === "done" ? 100 : item.progress}%`,
                  }}
                />
              </div>

              {item.error && <p className="mt-1 text-xs text-status-error-fg">{item.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
