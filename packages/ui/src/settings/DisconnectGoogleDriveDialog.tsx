"use client";

import { ConfirmDialog } from "../dashboard-shell/ConfirmDialog";

interface DisconnectGoogleDriveDialogProps {
  isOpen: boolean;
  email: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DisconnectGoogleDriveDialog({
  isOpen,
  email,
  busy = false,
  onConfirm,
  onCancel,
}: DisconnectGoogleDriveDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Disconnect Google Drive"
      description={`This will revoke Foundry's access to "${email}". Any future imports from this account will require reconnecting. Documents already imported will remain.`}
      confirmLabel="Disconnect"
      cancelLabel="Keep connected"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
