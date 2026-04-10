"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DesignUploadStatus =
  | "queued"
  | "getting_url"
  | "uploading"
  | "saving"
  | "done"
  | "failed";

export interface ManagedDesignFile {
  id: string;
  file: File;
  status: DesignUploadStatus;
  progress: number; // 0-100
  error?: string;
  assetId?: string;
  abortController: AbortController | null;
}

// ---------------------------------------------------------------------------
// Asset type inference
// ---------------------------------------------------------------------------

export function inferAssetType(fileName: string, mimeType: string): string {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "screenshot";
  if (["gif", "mp4", "mov", "webm"].includes(ext)) return "prototype";
  if (["json", "css", "scss"].includes(ext)) return "tokens";
  if (["md", "pdf"].includes(ext)) return "styleGuide";

  // Fallback via mimeType
  if (mimeType.startsWith("image/")) return "screenshot";
  if (mimeType.startsWith("video/")) return "prototype";

  return "styleGuide";
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

export function useDesignUploadQueue(options: {
  orgId: string;
  programId: string;
  maxConcurrent?: number;
  generateUploadUrl: (args: { orgId: string }) => Promise<string>;
  workstreamId?: string;
  requirementId?: string;
  saveAsset: (args: {
    orgId: string;
    programId: string;
    fileId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    type: string;
    content?: string;
    workstreamId?: string;
    requirementId?: string;
  }) => Promise<string>;
}): {
  files: ManagedDesignFile[];
  addFiles: (fileList: FileList) => void;
  removeFile: (id: string) => void;
  isUploading: boolean;
  allDone: boolean;
} {
  const {
    orgId,
    programId,
    maxConcurrent = 3,
    generateUploadUrl,
    saveAsset,
    workstreamId,
    requirementId,
  } = options;

  // Mutable source of truth (avoids stale closures in XHR callbacks)
  const mapRef = useRef<Map<string, ManagedDesignFile>>(new Map());
  const activeCountRef = useRef(0);

  // React-visible snapshot
  const [files, setFiles] = useState<ManagedDesignFile[]>([]);

  // RAF-throttled sync from map → state
  const rafRef = useRef<number | null>(null);
  const sync = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setFiles(Array.from(mapRef.current.values()));
    });
  }, []);

  // Helper to update a single managed file
  const updateEntry = useCallback(
    (id: string, patch: Partial<ManagedDesignFile>) => {
      const entry = mapRef.current.get(id);
      if (!entry) return;
      Object.assign(entry, patch);
      sync();
    },
    [sync],
  );

  // Queue processor (forward-declared so uploadFile can reference it)
  const processQueueRef = useRef<() => void>(() => {});

  // Upload pipeline for a single file
  const uploadFile = useCallback(
    async (managed: ManagedDesignFile) => {
      const { id, file } = managed;
      const abortController = new AbortController();
      updateEntry(id, { abortController });

      try {
        // Phase 1: get upload URL
        updateEntry(id, { status: "getting_url", progress: 0 });
        const uploadUrl = await generateUploadUrl({ orgId });

        if (abortController.signal.aborted) return;

        // Phase 2: upload bytes via XHR
        updateEntry(id, { status: "uploading" });
        const fileId = await xhrUpload(uploadUrl, file, abortController, (pct) =>
          updateEntry(id, { progress: pct }),
        );

        if (abortController.signal.aborted) return;

        // Phase 3: save asset record
        updateEntry(id, { status: "saving", progress: 100 });
        const assetType = inferAssetType(file.name, file.type);

        // Read file text content for token files so backend can parse them
        let content: string | undefined;
        if (assetType === "tokens") {
          try {
            content = await file.text();
          } catch {
            // Ignore read errors — file will still be stored in storage
          }
        }

        const assetId = await saveAsset({
          orgId,
          programId,
          fileId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          type: assetType,
          content,
          workstreamId,
          requirementId,
        });

        updateEntry(id, { status: "done", assetId, abortController: null });
      } catch (err: unknown) {
        if (abortController.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unknown upload error";
        updateEntry(id, {
          status: "failed",
          error: message,
          abortController: null,
        });
      } finally {
        activeCountRef.current = Math.max(0, activeCountRef.current - 1);
        processQueueRef.current();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, programId, workstreamId, requirementId, generateUploadUrl, saveAsset, updateEntry],
  );

  // Queue processor
  const processQueue = useCallback(() => {
    const entries = Array.from(mapRef.current.values());
    for (const entry of entries) {
      if (activeCountRef.current >= maxConcurrent) break;
      if (entry.status === "queued") {
        activeCountRef.current += 1;
        void uploadFile(entry);
      }
    }
  }, [maxConcurrent, uploadFile]);

  // Keep the ref current so uploadFile's finally block uses the latest version
  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  // Public API

  const addFiles = useCallback(
    (fileList: FileList) => {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const id = crypto.randomUUID();
        const managed: ManagedDesignFile = {
          id,
          file,
          status: "queued",
          progress: 0,
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

  // beforeunload warning when uploads are active
  const isUploading = files.some((f) => !["done", "failed", "queued"].includes(f.status));

  useEffect(() => {
    if (!isUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isUploading]);

  // Cleanup on unmount
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

  const allDone = files.length > 0 && files.every((f) => f.status === "done");

  return {
    files,
    addFiles,
    removeFile,
    isUploading,
    allDone,
  };
}
