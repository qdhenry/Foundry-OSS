"use client";

import { useEffect, useState } from "react";

export type ReAnalyzeFocus = "all" | "requirements" | "risks" | "integrations";
export type TargetPlatform = "salesforce_b2b" | "bigcommerce_b2b";

interface ReAnalyzeDialogProps {
  isOpen: boolean;
  documentName: string;
  defaultTargetPlatform: TargetPlatform;
  onCancel: () => void;
  onConfirm: (values: {
    focusArea: ReAnalyzeFocus;
    targetPlatform: TargetPlatform;
    instructions: string;
  }) => Promise<void> | void;
}

const SUGGESTIONS = [
  "Focus on payment and checkout integrations",
  "Prioritize security and compliance risks",
  "Extract data migration requirements only",
  "Identify API dependencies and integration points",
];

export function ReAnalyzeDialog({
  isOpen,
  documentName,
  defaultTargetPlatform,
  onCancel,
  onConfirm,
}: ReAnalyzeDialogProps) {
  const [focusArea, setFocusArea] = useState<ReAnalyzeFocus>("all");
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>(defaultTargetPlatform);
  const [instructions, setInstructions] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFocusArea("all");
    setTargetPlatform(defaultTargetPlatform);
    setInstructions("");
    setIsSaving(false);
  }, [isOpen, defaultTargetPlatform]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-xl border border-border-default bg-surface-default p-5 shadow-xl">
        <h3 className="text-base font-semibold text-text-heading">Re-analyze {documentName}</h3>
        <p className="mt-1 text-sm text-text-secondary">
          Focus the next analysis run for this document.
        </p>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-text-primary">Focus area</span>
            <select
              value={focusArea}
              onChange={(event) => setFocusArea(event.target.value as ReAnalyzeFocus)}
              className="select"
            >
              <option value="all">All findings</option>
              <option value="requirements">Requirements</option>
              <option value="risks">Risks</option>
              <option value="integrations">Integrations</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-text-primary">Target platform</span>
            <select
              value={targetPlatform}
              onChange={(event) => setTargetPlatform(event.target.value as TargetPlatform)}
              className="select"
            >
              <option value="salesforce_b2b">Salesforce B2B Commerce</option>
              <option value="bigcommerce_b2b">BigCommerce B2B</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-text-primary">Custom instructions</span>
            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value.slice(0, 500))}
              placeholder="Optional instructions for the next run"
              rows={4}
              className="textarea"
            />
            <span className="text-xs text-text-muted">{instructions.length}/500</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setInstructions(suggestion)}
                type="button"
                className="rounded-full border border-border-default px-2.5 py-1 text-xs text-text-primary hover:bg-interactive-hover"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <p className="text-xs text-text-secondary">
            Focus area and custom instructions are captured in UI now and will be sent once backend
            support for custom prompt overrides is available.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setIsSaving(true);
              try {
                await onConfirm({ focusArea, targetPlatform, instructions });
              } finally {
                setIsSaving(false);
              }
            }}
            type="button"
            disabled={isSaving}
            className="rounded-lg bg-accent-default px-3 py-2 text-sm font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-60"
          >
            {isSaving ? "Starting..." : "Re-analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
