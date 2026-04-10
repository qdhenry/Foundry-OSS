"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { GoogleDriveIcon } from "../discovery/GoogleDriveImportButton";

interface ConnectGoogleDriveButtonProps {
  orgId: string;
}

export function ConnectGoogleDriveButton({ orgId }: ConnectGoogleDriveButtonProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  const startOAuth = useMutation("googleDrive/credentials:startOAuth" as any);

  async function handleConnect() {
    if (isRedirecting || !orgId) return;
    setIsRedirecting(true);

    try {
      // Store current URL so the callback route can redirect back here
      document.cookie = `gdrive_return_url=${encodeURIComponent(window.location.pathname + window.location.search)}; path=/; max-age=600; SameSite=Lax`;

      const result = (await startOAuth({ orgId })) as { authorizationUrl: string };
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setIsRedirecting(false);
      const message =
        err instanceof Error ? err.message : "Could not start Google Drive connection";
      toast.error(message);
    }
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isRedirecting || !orgId}
      className="btn-primary btn-sm inline-flex items-center gap-2"
    >
      <GoogleDriveIcon className="h-4 w-4 shrink-0" />
      {isRedirecting ? "Redirecting..." : "Connect Google Drive"}
    </button>
  );
}
