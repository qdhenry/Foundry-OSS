"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileUploadStatus =
  | "queued"
  | "getting_url"
  | "uploading"
  | "saving"
  | "done"
  | "failed";

export type FileCategory =
  | "architecture"
  | "requirements"
  | "testing"
  | "deployment"
  | "meeting_notes"
  | "other";

export interface ManagedFile {
  id: string;
  file: File;
  category: FileCategory;
  status: FileUploadStatus;
  progress: number; // 0-100
  error: string | null;
  documentId: string | null; // set on "done"
  abortController: AbortController | null;
}

// ---------------------------------------------------------------------------
// Category detection
// ---------------------------------------------------------------------------

function detectCategory(fileName: string): FileCategory {
  const lower = fileName.toLowerCase();
  if (lower.includes("gap") || lower.includes("req") || lower.includes("spec"))
    return "requirements";
  if (lower.includes("arch") || lower.includes("design")) return "architecture";
  if (lower.includes("meeting") || lower.includes("notes") || lower.includes("minutes"))
    return "meeting_notes";
  if (lower.includes("test") || lower.includes("qa")) return "testing";
  if (lower.includes("deploy") || lower.includes("release")) return "deployment";
  return "other";
}

// ---------------------------------------------------------------------------
// XHR upload utility
// ---------------------------------------------------------------------------

function xhrUpload(
  url: string,
  file: File,
  abortController: AbortController,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Wire abort signal
    const onAbort = () => {
      xhr.abort();
      reject(new Error("Upload aborted"));
    };
    abortController.signal.addEventListener("abort", onAbort);

    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      abortController.signal.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText);
          resolve(body.storageId as string);
        } catch {
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      abortController.signal.removeEventListener("abort", onAbort);
      reject(new Error("Network error during upload"));
    };

    xhr.send(file);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useUploadQueue(options: {
  orgId: string;
  programId: string;
  maxConcurrent?: number; // default 3
  generateUploadUrl: (args: { orgId: string }) => Promise<string>;
  saveDocument: (args: {
    orgId: string;
    programId: string;
    storageId: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    category: FileCategory;
  }) => Promise<string>;
}): {
  files: ManagedFile[];
  addFiles: (fileList: FileList) => void;
  removeFile: (id: string) => void;
  retryFile: (id: string) => void;
  retryAllFailed: () => void;
  updateCategory: (id: string, category: FileCategory) => void;
  allDone: boolean;
  hasErrors: boolean;
  completedDocumentIds: string[];
  isUploading: boolean;
} {
  const { orgId, programId, maxConcurrent = 3, generateUploadUrl, saveDocument } = options;

  // ---- Mutable source of truth (avoids stale closures in XHR callbacks) ----
  const mapRef = useRef<Map<string, ManagedFile>>(new Map());
  const activeCountRef = useRef(0);

  // ---- React-visible snapshot ----
  const [files, setFiles] = useState<ManagedFile[]>([]);

  // RAF-throttled sync from map → state
  const rafRef = useRef<number | null>(null);
  const sync = useCallback(() => {
    if (rafRef.current !== null) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setFiles(Array.from(mapRef.current.values()));
    });
  }, []);

  // ---- Helpers to update a single managed file ----
  const updateEntry = useCallback(
    (id: string, patch: Partial<ManagedFile>) => {
      const entry = mapRef.current.get(id);
      if (!entry) return;
      Object.assign(entry, patch);
      sync();
    },
    [sync],
  );

  // ---- Upload pipeline for a single file ----
  const uploadFile = useCallback(
    async (managed: ManagedFile) => {
      const { id, file } = managed;
      const abortController = new AbortController();
      updateEntry(id, { abortController });

      try {
        // Phase 1: get upload URL
        updateEntry(id, { status: "getting_url", progress: 0 });
        const uploadUrl = await generateUploadUrl({ orgId });

        // Check if aborted between phases
        if (abortController.signal.aborted) return;

        // Phase 2: upload bytes via XHR
        updateEntry(id, { status: "uploading" });
        const storageId = await xhrUpload(uploadUrl, file, abortController, (pct) =>
          updateEntry(id, { progress: pct }),
        );

        // Check if aborted between phases
        if (abortController.signal.aborted) return;

        // Phase 3: save document record
        updateEntry(id, { status: "saving", progress: 100 });
        const entry = mapRef.current.get(id);
        const category = entry?.category ?? "other";

        const documentId = await saveDocument({
          orgId,
          programId,
          storageId,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          fileSize: file.size,
          category,
        });

        updateEntry(id, { status: "done", documentId, abortController: null });
      } catch (err: unknown) {
        // Don't set failed for aborted uploads (the file was removed)
        if (abortController.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unknown upload error";
        updateEntry(id, {
          status: "failed",
          error: message,
          abortController: null,
        });
      } finally {
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        processQueue();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, programId, generateUploadUrl, saveDocument, updateEntry],
  );

  // ---- Queue processor ----
  const processQueue = useCallback(() => {
    const entries = Array.from(mapRef.current.values());
    for (const entry of entries) {
      if (activeCountRef.current >= maxConcurrent) break;
      if (entry.status === "queued") {
        activeCountRef.current += 1;
        uploadFile(entry);
      }
    }
  }, [maxConcurrent, uploadFile]);

  // ---- Public API ----

  const addFiles = useCallback(
    (fileList: FileList) => {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const id = crypto.randomUUID();
        const managed: ManagedFile = {
          id,
          file,
          category: detectCategory(file.name),
          status: "queued",
          progress: 0,
          error: null,
          documentId: null,
          abortController: null,
        };
        mapRef.current.set(id, managed);
      }
      sync();
      processQueue();
    },
    [sync, processQueue],
  );

  const removeFile = useCallback(
    (id: string) => {
      const entry = mapRef.current.get(id);
      if (!entry) return;

      // Abort if mid-upload
      const isActive =
        entry.status === "getting_url" || entry.status === "uploading" || entry.status === "saving";
      if (isActive && entry.abortController) {
        entry.abortController.abort();
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
      }

      mapRef.current.delete(id);
      sync();
      processQueue();
    },
    [sync, processQueue],
  );

  const retryFile = useCallback(
    (id: string) => {
      const entry = mapRef.current.get(id);
      if (!entry || entry.status !== "failed") return;
      updateEntry(id, {
        status: "queued",
        progress: 0,
        error: null,
        documentId: null,
        abortController: null,
      });
      processQueue();
    },
    [updateEntry, processQueue],
  );

  const retryAllFailed = useCallback(() => {
    for (const entry of mapRef.current.values()) {
      if (entry.status === "failed") {
        Object.assign(entry, {
          status: "queued",
          progress: 0,
          error: null,
          documentId: null,
          abortController: null,
        });
      }
    }
    sync();
    processQueue();
  }, [sync, processQueue]);

  const updateCategory = useCallback(
    (id: string, category: FileCategory) => {
      updateEntry(id, { category });
    },
    [updateEntry],
  );

  // ---- Derived state ----
  const allDone = files.length > 0 && files.every((f) => f.status === "done");
  const hasErrors = files.some((f) => f.status === "failed");
  const isUploading = files.some((f) => !["done", "failed", "queued"].includes(f.status));
  const completedDocumentIds = files
    .filter((f) => f.status === "done" && f.documentId !== null)
    .map((f) => f.documentId as string);

  // ---- beforeunload warning ----
  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUploading]);

  // ---- Cleanup on unmount: abort all in-progress uploads ----
  useEffect(() => {
    return () => {
      for (const entry of mapRef.current.values()) {
        if (entry.abortController) {
          entry.abortController.abort();
        }
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return {
    files,
    addFiles,
    removeFile,
    retryFile,
    retryAllFailed,
    updateCategory,
    allDone,
    hasErrors,
    completedDocumentIds,
    isUploading,
  };
}
