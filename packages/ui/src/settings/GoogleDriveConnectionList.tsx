"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { GoogleDriveIcon } from "../discovery/GoogleDriveImportButton";
import { DisconnectGoogleDriveDialog } from "./DisconnectGoogleDriveDialog";

interface DriveCredential {
  _id: string;
  googleEmail: string;
  status: "active" | "expired" | "revoked";
  connectedAt: number;
  lastUsedAt: number;
  connectedByUserName?: string;
}

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-status-success-bg text-status-success-fg border border-status-success-border",
  expired: "bg-status-warning-bg text-status-warning-fg border border-status-warning-border",
  revoked: "bg-surface-raised text-text-secondary",
};

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface GoogleDriveConnectionListProps {
  orgId: string;
}

export function GoogleDriveConnectionList({ orgId }: GoogleDriveConnectionListProps) {
  const [disconnectTarget, setDisconnectTarget] = useState<DriveCredential | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const credentials = useQuery(
    "googleDrive/credentials:listByOrg" as any,
    orgId ? { orgId } : "skip",
  );

  const revokeCredential = useMutation("googleDrive/credentials:revoke" as any);

  async function handleDisconnectConfirm() {
    if (!disconnectTarget || isDisconnecting) return;
    setIsDisconnecting(true);
    const email = disconnectTarget.googleEmail;
    const credentialId = disconnectTarget._id;
    try {
      await revokeCredential({ credentialId });
      toast.success(`Disconnected ${email}`);
      setDisconnectTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect";
      toast.error(`Could not disconnect: ${message}`);
    } finally {
      setIsDisconnecting(false);
    }
  }

  const isLoading = credentials === undefined;
  const credentialList = (credentials as DriveCredential[] | null) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-elevated" />
        ))}
      </div>
    );
  }

  if (credentialList.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-default p-6 text-center">
        <GoogleDriveIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm text-text-secondary">No Google Drive connections yet.</p>
        <p className="mt-1 text-xs text-text-muted">
          Connect a Google account to import documents from Drive into any program.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-border-default">
        <table className="w-full text-sm">
          <thead className="border-b border-border-default bg-surface-raised">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                Account
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                Connected by
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                Connected
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-secondary">
                Last used
              </th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {credentialList.map((cred) => (
              <tr key={cred._id} className="border-b border-border-default last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <GoogleDriveIcon className="h-4 w-4 shrink-0" />
                    <span className="font-medium text-text-heading">{cred.googleEmail}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_CLASSES[cred.status] ?? STATUS_CLASSES.revoked
                    }`}
                  >
                    {cred.status === "active"
                      ? "Active"
                      : cred.status === "expired"
                        ? "Expired"
                        : "Revoked"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  {cred.connectedByUserName ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  {formatRelativeTime(cred.connectedAt)}
                </td>
                <td className="px-4 py-3 text-xs text-text-secondary">
                  {formatRelativeTime(cred.lastUsedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setDisconnectTarget(cred)}
                    className="rounded border border-status-error-border px-2 py-1 text-xs text-status-error-fg hover:bg-status-error-bg"
                  >
                    Disconnect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DisconnectGoogleDriveDialog
        isOpen={disconnectTarget !== null}
        email={disconnectTarget?.googleEmail ?? ""}
        busy={isDisconnecting}
        onConfirm={handleDisconnectConfirm}
        onCancel={() => setDisconnectTarget(null)}
      />
    </>
  );
}
