"use client";

import { AlertTriangle } from "@untitledui/icons";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "@/components/application/modals/modal";

// ── Types ────────────────────────────────────────────────────────────

export interface ConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal is dismissed (cancel or overlay click) */
  onClose: () => void;
  /** Callback when the confirm action is triggered */
  onConfirm: () => void | Promise<void>;
  /** Modal title */
  title: string;
  /** Descriptive message explaining the action */
  description: string;
  /** Label for the confirm button */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Visual tone — "danger" renders the icon and confirm button in error styling */
  tone?: "danger" | "neutral";
  /** Whether the confirm action is in progress */
  isLoading?: boolean;
}

// ── Component ────────────────────────────────────────────────────────

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
  isLoading = false,
}: ConfirmModalProps) {
  const isDanger = tone === "danger";

  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalOverlay isDismissable>
        <Modal className="max-w-md">
          <Dialog>
            <div className="w-full rounded-xl border border-border-default bg-surface-default shadow-lg">
              <div className="modal-header flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isDanger
                      ? "bg-status-error-bg border border-status-error-border"
                      : "bg-surface-raised border border-border-default"
                  }`}
                >
                  <AlertTriangle
                    size={20}
                    className={isDanger ? "text-status-error-fg" : "text-text-muted"}
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-text-heading">{title}</h3>
                  <p className="mt-1 text-sm text-text-secondary">{description}</p>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  onClick={onClose}
                  type="button"
                  disabled={isLoading}
                  className="btn-secondary btn-sm"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={handleConfirm}
                  type="button"
                  disabled={isLoading}
                  className={
                    isDanger
                      ? "rounded-lg bg-status-error-fg px-3 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-60"
                      : "btn-primary btn-sm"
                  }
                >
                  {isLoading ? "..." : confirmLabel}
                </button>
              </div>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
