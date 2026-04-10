"use client";

import { useAction, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DuplicateImportDialog } from "./DuplicateImportDialog";
import { useDriveImportQueue } from "./useDriveImportQueue";
import { type DriveFile, useGooglePicker } from "./useGooglePicker";

interface GoogleDriveImportButtonProps {
  orgId: string;
  programId: string;
  onImportStarted?: (count: number) => void;
  onImportComplete?: (documentIds: string[]) => void;
  onImportingChange?: (isImporting: boolean) => void;
}

const IMPORT_STATUS_LABEL: Record<string, string> = {
  importing: "Importing…",
  done: "Done",
  failed: "Failed",
};

const IMPORT_STATUS_COLOR: Record<string, string> = {
  importing: "text-text-secondary",
  done: "text-status-success-fg",
  failed: "text-status-error-fg",
};

export function GoogleDriveImportButton({
  orgId,
  programId,
  onImportStarted,
  onImportComplete,
  onImportingChange,
}: GoogleDriveImportButtonProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "";
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

  // Current user's Drive credential (null = none connected, undefined = loading)
  const credential = useQuery(
    "googleDrive/credentials:getMyCredential" as any,
    orgId ? { orgId } : "skip",
  );

  const getAccessToken = useAction("googleDrive/credentials:getAccessTokenForPicker" as any);
  const importFromDrive = useAction("googleDrive/importActions:importDriveFiles" as any);
  const checkBatchDuplicates = useAction("googleDrive/credentials:checkBatchDuplicates" as any);

  const { imports, startImport, removeImport, isImporting, completedDocumentIds } =
    useDriveImportQueue({ orgId, programId, importFromDrive: importFromDrive as any });

  // Track completed IDs so we can fire onImportComplete once per batch
  const reportedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const newIds = completedDocumentIds.filter((id) => !reportedIdsRef.current.has(id));
    if (newIds.length === 0) return;
    for (const id of newIds) reportedIdsRef.current.add(id);
    onImportComplete?.(newIds);
  }, [completedDocumentIds, onImportComplete]);

  useEffect(() => {
    onImportingChange?.(isImporting);
  }, [isImporting, onImportingChange]);

  // Pending files waiting for duplicate confirmation
  const [pendingFiles, setPendingFiles] = useState<DriveFile[]>([]);
  const [pendingCredentialId, setPendingCredentialId] = useState<string>("");
  const [duplicates, setDuplicates] = useState<
    Array<{ driveFileId: string; fileName: string; importedAt: number }>
  >([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const { pickerState, sdkError, openPicker } = useGooglePicker({
    apiKey,
    clientId,
    onFilesSelected: useCallback(
      async (files: DriveFile[]) => {
        if (files.length === 0) return;

        const credId = (credential as any)?._id;
        if (!credId) return;

        // Check for duplicates before importing
        let dupes: Array<{ driveFileId: string; fileName: string; importedAt: number }> = [];
        try {
          dupes = (await checkBatchDuplicates({
            programId,
            driveFileIds: files.map((f) => f.id),
          })) as typeof dupes;
        } catch {
          // Non-fatal: proceed without duplicate check
        }

        if (dupes.length > 0) {
          setPendingFiles(files);
          setPendingCredentialId(credId);
          setDuplicates(dupes);
          setShowDuplicateDialog(true);
          return;
        }

        // No duplicates — import immediately
        onImportStarted?.(files.length);
        try {
          await startImport(files, credId);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Import failed";
          toast.error(`Google Drive import failed: ${message}`);
        }
      },
      [credential, checkBatchDuplicates, programId, startImport, onImportStarted],
    ),
  });

  async function handleClick() {
    const credId = (credential as any)?._id;
    if (!credId) return;
    try {
      const accessToken = (await getAccessToken({
        orgId,
        credentialId: credId,
      })) as string;
      openPicker(accessToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      if (
        message.toLowerCase().includes("expired") ||
        message.toLowerCase().includes("reconnect")
      ) {
        toast.error(
          "Google Drive connection needs re-authorization. Go to Settings → Integrations to reconnect.",
        );
      } else {
        toast.error(`Could not open Google Drive: ${message}`);
      }
    }
  }

  async function handleDuplicateConfirm() {
    setShowDuplicateDialog(false);
    const files = pendingFiles;
    const credId = pendingCredentialId;
    setPendingFiles([]);
    setPendingCredentialId("");
    setDuplicates([]);

    onImportStarted?.(files.length);
    try {
      await startImport(files, credId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast.error(`Google Drive import failed: ${message}`);
    }
  }

  function handleDuplicateCancel() {
    setShowDuplicateDialog(false);
    setPendingFiles([]);
    setPendingCredentialId("");
    setDuplicates([]);
  }

  if (sdkError) {
    return <p className="text-xs italic text-text-muted">{sdkError}</p>;
  }

  const isConnected = (credential as any)?.status === "active";
  const isLoadingSdk = pickerState === "loading_sdk";
  const isDisabled =
    isImporting || isLoadingSdk || !isConnected || !apiKey || !clientId || credential === undefined;

  const tooltipText =
    !apiKey || !clientId
      ? "Google Drive not configured"
      : credential === undefined
        ? "Loading..."
        : !isConnected
          ? "Connect Google Drive in Settings → Integrations first"
          : isLoadingSdk
            ? "Loading Google Picker..."
            : "Import files from Google Drive (up to 10)";

  return (
    <>
      <div>
        <button
          type="button"
          disabled={isDisabled}
          onClick={handleClick}
          title={tooltipText}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-interactive-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GoogleDriveIcon className="h-3.5 w-3.5 shrink-0" />
          {isImporting ? "Importing…" : isLoadingSdk ? "Loading…" : "Import from Drive"}
        </button>

        {/* Per-file import status */}
        {imports.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {imports.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-text-heading">
                    {item.name}
                    {item.duplicate && (
                      <span className="ml-1.5 rounded bg-status-warning-bg px-1 py-0.5 text-[10px] text-status-warning-fg">
                        re-import
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={IMPORT_STATUS_COLOR[item.status] ?? "text-text-secondary"}>
                      {IMPORT_STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {item.status === "failed" && (
                      <button
                        type="button"
                        onClick={() => removeImport(item.id)}
                        className="text-text-muted hover:text-text-primary"
                        title="Dismiss"
                        aria-label="Dismiss error"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                {item.status === "failed" && item.error && (
                  <p className="mt-0.5 text-status-error-fg">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <DuplicateImportDialog
        isOpen={showDuplicateDialog}
        duplicates={duplicates}
        onConfirm={handleDuplicateConfirm}
        onCancel={handleDuplicateCancel}
      />
    </>
  );
}

export function GoogleDriveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" fill="none" aria-hidden>
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}
