"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveFile } from "./useGooglePicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriveImportStatus = "importing" | "done" | "failed";

export interface ManagedDriveImport {
  id: string; // driveFileId
  name: string;
  status: DriveImportStatus;
  error?: string;
  documentId?: string;
  duplicate?: boolean;
}

type ImportResult = {
  fileId: string;
  documentId?: string;
  duplicate?: boolean;
  error?: string;
};

type ImportFn = (args: {
  orgId: string;
  programId: string;
  credentialId: string;
  category: "other";
  files: Array<{
    fileId: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    webViewLink?: string;
    size?: number;
  }>;
}) => Promise<ImportResult[]>;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDriveImportQueue({
  orgId,
  programId,
  importFromDrive,
}: {
  orgId: string;
  programId: string;
  importFromDrive: ImportFn;
}): {
  imports: ManagedDriveImport[];
  startImport: (files: DriveFile[], credentialId: string) => Promise<void>;
  removeImport: (id: string) => void;
  clearCompleted: () => void;
  isImporting: boolean;
  hasErrors: boolean;
  completedDocumentIds: string[];
} {
  const mapRef = useRef<Map<string, ManagedDriveImport>>(new Map());
  const [imports, setImports] = useState<ManagedDriveImport[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const rafRef = useRef<number | null>(null);
  const sync = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setImports(Array.from(mapRef.current.values()));
    });
  }, []);

  const startImport = useCallback(
    async (files: DriveFile[], credentialId: string) => {
      if (files.length === 0) return;
      setIsImporting(true);

      // Add all files with "importing" status
      for (const file of files) {
        mapRef.current.set(file.id, {
          id: file.id,
          name: file.name,
          status: "importing",
        });
      }
      sync();

      try {
        const results = await importFromDrive({
          orgId,
          programId,
          credentialId,
          category: "other",
          files: files.map((f) => ({
            fileId: f.id,
            name: f.name,
            mimeType: f.mimeType,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink,
            size: f.sizeBytes,
          })),
        });

        for (const result of results) {
          const entry = mapRef.current.get(result.fileId);
          if (!entry) continue;
          if (result.error) {
            Object.assign(entry, { status: "failed", error: result.error });
          } else {
            Object.assign(entry, {
              status: "done",
              documentId: result.documentId,
              duplicate: result.duplicate ?? false,
            });
          }
        }
        sync();
      } catch (err) {
        // Batch-level failure — mark all in-flight files as failed
        for (const file of files) {
          const entry = mapRef.current.get(file.id);
          if (entry && entry.status === "importing") {
            Object.assign(entry, {
              status: "failed",
              error: err instanceof Error ? err.message : "Import failed",
            });
          }
        }
        sync();
      } finally {
        setIsImporting(false);
      }
    },
    [orgId, programId, importFromDrive, sync],
  );

  const removeImport = useCallback(
    (id: string) => {
      mapRef.current.delete(id);
      sync();
    },
    [sync],
  );

  const clearCompleted = useCallback(() => {
    for (const [id, entry] of mapRef.current.entries()) {
      if (entry.status === "done") {
        mapRef.current.delete(id);
      }
    }
    sync();
  }, [sync]);

  // Auto-clear completed imports after 3 seconds
  useEffect(() => {
    const doneIds = imports.filter((i) => i.status === "done").map((i) => i.id);
    if (doneIds.length === 0) return;

    const timer = setTimeout(() => {
      for (const id of doneIds) {
        mapRef.current.delete(id);
      }
      sync();
    }, 3000);
    return () => clearTimeout(timer);
  }, [imports, sync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const completedDocumentIds = imports
    .filter((i) => i.status === "done" && i.documentId)
    .map((i) => i.documentId as string);

  const hasErrors = imports.some((i) => i.status === "failed");

  return {
    imports,
    startImport,
    removeImport,
    clearCompleted,
    isImporting,
    hasErrors,
    completedDocumentIds,
  };
}
