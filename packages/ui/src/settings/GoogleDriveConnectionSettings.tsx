"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ConnectGoogleDriveButton } from "./ConnectGoogleDriveButton";
import { GoogleDriveConnectionList } from "./GoogleDriveConnectionList";

export function GoogleDriveConnectionSettings() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";

  const credentials = useQuery(
    "googleDrive/credentials:listByOrg" as any,
    orgId ? { orgId } : "skip",
  );

  const activeCount = Array.isArray(credentials)
    ? (credentials as any[]).filter((c) => c.status === "active").length
    : 0;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">Google Drive</h2>
          {credentials !== undefined && activeCount > 0 && (
            <span className="rounded-full border border-status-success-border bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-fg">
              {activeCount} connected
            </span>
          )}
        </div>
        {orgId && <ConnectGoogleDriveButton orgId={orgId} />}
      </div>

      <p className="mb-4 text-sm text-text-secondary">
        Connect Google Drive to import documents directly into Foundry programs. Each team member
        connects their own Google account — connections are visible to org admins.
      </p>

      {orgId && <GoogleDriveConnectionList orgId={orgId} />}
    </div>
  );
}
