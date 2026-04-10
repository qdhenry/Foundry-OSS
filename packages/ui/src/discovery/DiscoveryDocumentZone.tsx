"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { type DragEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "../dashboard-shell/ConfirmDialog";
import { ServiceUnavailableError, useServiceGate } from "../resilience/useServiceGate";
import { GoogleDriveIcon, GoogleDriveImportButton } from "./GoogleDriveImportButton";
import { ReAnalyzeDialog, type TargetPlatform } from "./ReAnalyzeDialog";
import { type FileUploadStatus, useUploadQueue } from "./useUploadQueue";

export type DocumentSortOrder = "newest" | "oldest" | "name";

interface DiscoveryDocumentZoneProps {
  programId: string;
  orgId: string;
  targetPlatform: TargetPlatform;
  sortOrder: DocumentSortOrder;
  onSortOrderChange: (value: DocumentSortOrder) => void;
}

const CATEGORY_OPTIONS = [
  { value: "architecture", label: "Architecture" },
  { value: "requirements", label: "Requirements" },
  { value: "testing", label: "Testing" },
  { value: "deployment", label: "Deployment" },
  { value: "meeting_notes", label: "Meeting Notes" },
  { value: "other", label: "Other" },
] as const;

const ACCEPTED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "xls", "csv", "txt", "md"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "avi"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const STATUS_BADGE: Record<string, string> = {
  none: "bg-surface-elevated text-text-secondary",
  queued: "bg-surface-elevated text-text-secondary",
  analyzing: "bg-status-info-bg text-status-info-fg",
  complete: "bg-status-success-bg text-status-success-fg",
  completed: "bg-status-success-bg text-status-success-fg",
  failed: "bg-status-error-bg text-status-error-fg",
};

const STATUS_LABEL: Record<string, string> = {
  none: "Not analyzed",
  queued: "Queued",
  analyzing: "Analyzing",
  complete: "Analyzed",
  completed: "Analyzed",
  failed: "Failed",
};

const UPLOAD_STATUS_LABEL: Record<FileUploadStatus, string> = {
  queued: "Queued",
  getting_url: "Preparing",
  uploading: "Uploading",
  saving: "Saving",
  done: "Done",
  failed: "Failed",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getFileExtension(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function isVideoFile(fileName: string): boolean {
  return VIDEO_EXTENSIONS.has(getFileExtension(fileName));
}

function validateFiles(fileList: FileList) {
  const errors: string[] = [];
  const validFiles: File[] = [];

  for (const file of Array.from(fileList)) {
    const extension = getFileExtension(file.name);

    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      errors.push(`${file.name}: unsupported type .${extension || "unknown"}`);
      continue;
    }

    if (file.size > MAX_FILE_BYTES) {
      errors.push(`${file.name}: exceeds 50MB (${formatFileSize(file.size)})`);
      continue;
    }

    validFiles.push(file);
  }

  return { errors, validFiles };
}

export function DiscoveryDocumentZone({
  programId,
  orgId,
  targetPlatform,
  sortOrder,
  onSortOrderChange,
}: DiscoveryDocumentZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showCount, setShowCount] = useState(10);
  const [localErrors, setLocalErrors] = useState<string[]>([]);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [reAnalyzeDoc, setReAnalyzeDoc] = useState<any | null>(null);
  const [runningAnalyze, setRunningAnalyze] = useState(false);
  const [categorizingIds, setCategorizingIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<Map<string, number>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const categorizedRef = useRef<Set<string>>(new Set());

  const documents = useQuery("documents:listByProgram" as any, {
    programId,
  });

  // Activity stream data for analyzing documents
  const batchProgress = useQuery("documentAnalysis:getBatchProgress" as any, {
    programId,
  });
  const activityLogs = useQuery("documentAnalysis:getActivityLogs" as any, {
    programId,
  });

  const logsByDocumentId = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!batchProgress || !activityLogs) return map;

    // Build analysisId → documentId lookup
    const analysisToDoc = new Map<string, string>();
    for (const item of batchProgress) {
      analysisToDoc.set(item.analysisId, item.documentId);
    }

    // Group logs by documentId
    for (const log of activityLogs) {
      const docId = analysisToDoc.get(log.analysisId);
      if (!docId) continue;
      const existing = map.get(docId) ?? [];
      existing.push(log);
      map.set(docId, existing);
    }

    return map;
  }, [batchProgress, activityLogs]);

  const generateUploadUrl = useMutation("documents:generateUploadUrl" as any);
  const saveDocument = useMutation("documents:save" as any);
  const updateDocument = useMutation("documents:update" as any);
  const removeDocument = useMutation("documents:remove" as any);
  const queueBatchAnalysis = useAction("documentAnalysisActions:queueBatchAnalysis" as any);
  const categorizeDocument = useAction("documents:categorize" as any);
  const { assertAvailable } = useServiceGate();

  const queue = useUploadQueue({
    orgId,
    programId,
    generateUploadUrl: async (args) => generateUploadUrl(args),
    saveDocument: async (args) => {
      const id = await saveDocument({
        ...args,
        programId,
        storageId: args.storageId as any,
      });
      return id as string;
    },
  });

  const sortedDocuments = useMemo(() => {
    if (!documents) return [];
    const copy = [...documents];

    if (sortOrder === "newest") {
      copy.sort((a, b) => b._creationTime - a._creationTime);
    }

    if (sortOrder === "oldest") {
      copy.sort((a, b) => a._creationTime - b._creationTime);
    }

    if (sortOrder === "name") {
      copy.sort((a, b) => a.fileName.localeCompare(b.fileName));
    }

    return copy.filter((doc: any) => !pendingDeletes.has(doc._id));
  }, [documents, sortOrder, pendingDeletes]);

  const visibleDocuments = sortedDocuments.slice(0, showCount);

  const unanalyzedDocuments = useMemo(() => {
    return sortedDocuments.filter((document) => {
      if (isVideoFile(document.fileName)) return false;
      const status = document.analysisStatus ?? "none";
      return status === "none" || status === "failed";
    });
  }, [sortedDocuments]);

  const failedDocuments = useMemo(() => {
    return sortedDocuments.filter((document) => (document.analysisStatus ?? "none") === "failed");
  }, [sortedDocuments]);

  useEffect(() => {
    if (queue.completedDocumentIds.length === 0) return;

    const pending = queue.completedDocumentIds.filter((id) => !categorizedRef.current.has(id));
    if (pending.length === 0) return;

    for (const documentId of pending) {
      categorizedRef.current.add(documentId);
      setCategorizingIds((prev) => new Set(prev).add(documentId));
      void categorizeDocument({
        documentId,
      })
        .catch(() => {
          // Silent fallback: manual category override remains available.
        })
        .finally(() => {
          setCategorizingIds((prev) => {
            const next = new Set(prev);
            next.delete(documentId);
            return next;
          });
        });
    }
  }, [categorizeDocument, queue.completedDocumentIds]);

  // Auto-clear completed upload queue items after a short delay
  useEffect(() => {
    const doneIds = queue.files.filter((f) => f.status === "done").map((f) => f.id);
    if (doneIds.length === 0) return;

    const timer = setTimeout(() => {
      doneIds.forEach((id) => queue.removeFile(id));
    }, 2000);
    return () => clearTimeout(timer);
  }, [queue.files, queue.removeFile]);

  const enqueueFiles = useCallback(
    (files: FileList) => {
      const { errors, validFiles } = validateFiles(files);
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

  async function handleAnalyze(
    ids: string[],
    platform: TargetPlatform,
    options?: { focusArea?: string; customInstructions?: string },
  ) {
    if (ids.length === 0 || runningAnalyze) return;

    try {
      assertAvailable(["convex", "anthropic"]);
    } catch (e) {
      if (e instanceof ServiceUnavailableError) {
        toast.error(e.message);
        return;
      }
      throw e;
    }

    setRunningAnalyze(true);
    try {
      await queueBatchAnalysis({
        orgId,
        programId,
        documentIds: ids,
        targetPlatform: platform,
        focusArea: options?.focusArea,
        customInstructions: options?.customInstructions,
      });
    } finally {
      setRunningAnalyze(false);
    }
  }

  async function handleCategoryChange(documentId: string, category: string) {
    setBusyDocId(documentId);
    try {
      await updateDocument({
        documentId,
        category: category as any,
      });
      const label = CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
      toast.success(`Category updated to ${label}`);
    } catch {
      toast.error("Failed to update category");
    } finally {
      setBusyDocId(null);
    }
  }

  function requestDelete(documentId: string, fileName: string) {
    setDeleteTarget({ id: documentId, name: fileName });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visibleDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleDocuments.map((d: any) => d._id)));
    }
  }

  async function handleBulkDelete() {
    for (const id of selectedIds) {
      const doc = visibleDocuments.find((d: any) => d._id === id);
      if (doc) requestDelete(doc._id, doc.fileName);
    }
    setSelectedIds(new Set());
  }

  async function handleBulkReanalyze() {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    await handleAnalyze(ids, targetPlatform);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);

    const timerId = window.setTimeout(async () => {
      setPendingDeletes((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      try {
        await removeDocument({ documentId: id });
      } catch {
        toast.error(`Failed to delete "${name}"`);
      }
    }, 10_000);

    setPendingDeletes((prev) => new Map(prev).set(id, timerId));

    toast(`"${name}" deleted`, {
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: () => {
          window.clearTimeout(timerId);
          setPendingDeletes((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
          });
        },
      },
    });
  }

  useEffect(() => {
    return () => {
      pendingDeletes.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [pendingDeletes]);

  return (
    <section className="rounded-xl border border-border-default bg-surface-default">
      <div className="p-5">
        {/* Enlarged upload CTA */}
        <div
          className={`cursor-pointer rounded-xl border-2 border-dashed py-10 text-center transition-colors ${
            isDragging
              ? "border-accent-default bg-status-warning-bg"
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
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md"
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
            Drag and drop discovery docs, or click to browse
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            PDF, DOCX, XLSX, XLS, CSV, TXT, MD · up to 50MB each
          </p>
        </div>

        {localErrors.length > 0 && (
          <div className="mt-3 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-xs text-status-error-fg">
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

        {queue.files.length > 0 && (
          <div className="mt-4 space-y-2">
            {queue.files.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border-default bg-surface-raised px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-heading">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-text-secondary">{formatFileSize(item.file.size)}</p>
                  </div>
                  <span className="text-xs text-text-secondary">
                    {UPLOAD_STATUS_LABEL[item.status]}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className={`h-full rounded-full ${item.status === "failed" ? "bg-red-500" : "bg-accent-default"}`}
                    style={{ width: `${item.status === "done" ? 100 : item.progress}%` }}
                  />
                </div>

                {item.error && <p className="mt-1 text-xs text-status-error-fg">{item.error}</p>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
            Sort
            <select
              value={sortOrder}
              onChange={(event) => onSortOrderChange(event.target.value as DocumentSortOrder)}
              className="select"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name</option>
            </select>
          </label>

          <button
            type="button"
            disabled={unanalyzedDocuments.length === 0 || runningAnalyze || !documents}
            onClick={() =>
              handleAnalyze(
                unanalyzedDocuments.slice(0, 10).map((document) => document._id),
                targetPlatform,
              )
            }
            className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
            title={
              unanalyzedDocuments.length === 0
                ? "No unanalyzed documents"
                : `Analyze up to 10 documents`
            }
          >
            {runningAnalyze
              ? "Queueing..."
              : `Analyze ${Math.min(10, unanalyzedDocuments.length)} Document${Math.min(10, unanalyzedDocuments.length) === 1 ? "" : "s"}`}
          </button>

          <button
            type="button"
            disabled={failedDocuments.length === 0 || runningAnalyze}
            onClick={() =>
              handleAnalyze(
                failedDocuments.map((document) => document._id),
                targetPlatform,
              )
            }
            className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-interactive-hover disabled:cursor-not-allowed disabled:opacity-40"
            title={
              failedDocuments.length === 0
                ? "No failed analyses to retry"
                : `Retry ${failedDocuments.length} failed analyses`
            }
          >
            Retry Failed ({failedDocuments.length})
          </button>

          <div className="ml-auto">
            <GoogleDriveImportButton
              orgId={orgId}
              programId={programId}
              onImportComplete={(documentIds) => {
                // Trigger auto-categorization for Drive-imported documents
                for (const documentId of documentIds) {
                  if (categorizedRef.current.has(documentId)) continue;
                  categorizedRef.current.add(documentId);
                  setCategorizingIds((prev) => new Set(prev).add(documentId));
                  void categorizeDocument({ documentId })
                    .catch(() => {})
                    .finally(() => {
                      setCategorizingIds((prev) => {
                        const next = new Set(prev);
                        next.delete(documentId);
                        return next;
                      });
                    });
                }
              }}
            />
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-accent-default bg-accent-default/5 px-3 py-2">
            <span className="text-xs font-medium text-text-primary">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="rounded border border-status-error-border px-2 py-1 text-xs text-status-error-fg hover:bg-status-error-bg"
            >
              Delete Selected
            </button>
            <button
              type="button"
              onClick={handleBulkReanalyze}
              disabled={runningAnalyze}
              className="rounded border border-border-default px-2 py-1 text-xs text-text-primary hover:bg-interactive-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Re-analyze Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-text-secondary hover:text-text-primary"
            >
              Clear selection
            </button>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-lg border border-border-default">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-default bg-surface-raised">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={
                      visibleDocuments.length > 0 && selectedIds.size === visibleDocuments.length
                    }
                    onChange={toggleSelectAll}
                    className="rounded border-border-default"
                    aria-label="Select all documents"
                  />
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Document
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Category
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Status
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Date
                </th>
                <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {!documents ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border-default animate-pulse">
                    <td className="px-3 py-3">
                      <div className="h-4 w-4 rounded bg-surface-elevated" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-4 w-48 rounded bg-surface-elevated" />
                      <div className="mt-1 h-3 w-16 rounded bg-surface-elevated" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-6 w-24 rounded bg-surface-elevated" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-5 w-16 rounded-full bg-surface-elevated" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-3 w-20 rounded bg-surface-elevated" />
                    </td>
                    <td className="px-3 py-3">
                      <div className="h-6 w-28 rounded bg-surface-elevated" />
                    </td>
                  </tr>
                ))
              ) : visibleDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-text-secondary">
                    No documents uploaded yet.
                  </td>
                </tr>
              ) : (
                visibleDocuments.map((document) => {
                  const status = document.analysisStatus ?? "none";
                  const isVideo = isVideoFile(document.fileName);
                  const isActive = status === "queued" || status === "analyzing";
                  const docLogs = logsByDocumentId.get(document._id) ?? [];
                  const recentDocLogs = docLogs.slice(-8);
                  return (
                    <Fragment key={document._id}>
                      <tr className="border-b border-border-default">
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(document._id)}
                            onChange={() => toggleSelect(document._id)}
                            className="rounded border-border-default"
                            aria-label={`Select ${document.fileName}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-text-heading">{document.fileName}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-xs text-text-secondary">
                                  {formatFileSize(document.fileSize)}
                                </span>
                                {(document as any).source === "google_drive" && (
                                  <span className="inline-flex items-center gap-1 rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                                    <GoogleDriveIcon className="h-2.5 w-2.5 shrink-0" />
                                    Google Drive
                                  </span>
                                )}
                                {(document as any).driveWebViewLink && (
                                  <a
                                    href={(document as any).driveWebViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[10px] text-accent-default underline-offset-2 hover:underline"
                                  >
                                    View in Drive
                                  </a>
                                )}
                              </div>
                            </div>
                            {isVideo && (
                              <span className="mt-0.5 shrink-0 rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] font-semibold uppercase text-text-secondary">
                                Video
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-2">
                            <select
                              disabled={busyDocId === document._id}
                              value={document.category}
                              onChange={(event) =>
                                handleCategoryChange(document._id, event.target.value)
                              }
                              className="rounded border border-border-default bg-surface-default px-2 py-1 text-xs"
                            >
                              {CATEGORY_OPTIONS.map((category) => (
                                <option key={category.value} value={category.value}>
                                  {category.label}
                                </option>
                              ))}
                            </select>
                            {categorizingIds.has(document._id) && (
                              <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-[11px] font-medium text-status-info-fg">
                                Categorizing...
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_BADGE[status] ?? STATUS_BADGE.none
                            }`}
                          >
                            {STATUS_LABEL[status] ?? STATUS_LABEL.none}
                          </span>
                          {status === "failed" && (document as any).analysisError && (
                            <p className="mt-1 text-xs text-status-error-fg">
                              {(document as any).analysisError}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-text-secondary">
                          {formatDate(document._creationTime)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={runningAnalyze || busyDocId === document._id}
                              onClick={() => setReAnalyzeDoc(document)}
                              className="rounded border border-border-default px-2 py-1 text-xs text-text-primary hover:bg-interactive-hover disabled:opacity-60"
                            >
                              Re-analyze
                            </button>
                            <button
                              type="button"
                              disabled={busyDocId === document._id}
                              onClick={() => requestDelete(document._id, document.fileName)}
                              className="rounded border border-status-error-border px-2 py-1 text-xs text-status-error-fg hover:bg-status-error-bg disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {(isActive || status === "failed") && (
                        <tr className="border-b border-status-info-border">
                          <td colSpan={6} className="bg-status-info-bg/50 px-3 py-2">
                            <div className="flex items-center gap-2 text-xs text-status-info-fg">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                              </span>
                              {recentDocLogs.length > 0 ? (
                                <div className="flex-1 space-y-0.5">
                                  {recentDocLogs.map((log: any) => (
                                    <div
                                      key={log._id}
                                      className="flex items-center justify-between gap-3"
                                    >
                                      <span
                                        className={
                                          log.level === "error"
                                            ? "text-status-error-fg"
                                            : "text-text-secondary"
                                        }
                                      >
                                        {log.message}
                                      </span>
                                      <span className="shrink-0 tabular-nums text-text-muted">
                                        {formatTime(log._creationTime)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span>Waiting for agent to start...</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {documents && documents.length > showCount && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => setShowCount((prev) => prev + 10)}
              className="rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-interactive-hover"
            >
              Show More
            </button>
          </div>
        )}
      </div>

      <ReAnalyzeDialog
        isOpen={reAnalyzeDoc !== null}
        documentName={reAnalyzeDoc?.fileName ?? "document"}
        defaultTargetPlatform={targetPlatform}
        onCancel={() => setReAnalyzeDoc(null)}
        onConfirm={async ({ targetPlatform: selectedPlatform, focusArea, instructions }) => {
          if (!reAnalyzeDoc) return;
          await handleAnalyze([reAnalyzeDoc._id], selectedPlatform, {
            focusArea,
            customInstructions: instructions.trim() || undefined,
          });
          setReAnalyzeDoc(null);
        }}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Delete document"
        description={`This will permanently delete "${deleteTarget?.name ?? ""}" and all its analysis results. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
