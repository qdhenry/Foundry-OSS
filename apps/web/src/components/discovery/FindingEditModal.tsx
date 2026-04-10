"use client";

import { useCallback, useEffect, useState } from "react";
import type { FindingData } from "./FindingCard";

interface FindingEditModalProps {
  finding: FindingData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (findingId: string, editedData: Record<string, unknown>) => void;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-primary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-heading focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const baseClasses =
    "w-full rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-heading focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default";
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-text-primary">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={baseClasses}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={baseClasses}
        />
      )}
    </div>
  );
}

const PRIORITY_OPTIONS = [
  { value: "must_have", label: "Must Have" },
  { value: "should_have", label: "Should Have" },
  { value: "nice_to_have", label: "Nice to Have" },
  { value: "deferred", label: "Deferred" },
];

const FITGAP_OPTIONS = [
  { value: "native", label: "Native" },
  { value: "config", label: "Config" },
  { value: "custom_dev", label: "Custom Dev" },
  { value: "third_party", label: "Third Party" },
  { value: "not_feasible", label: "Not Feasible" },
];

const EFFORT_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const PROBABILITY_OPTIONS = [
  { value: "very_likely", label: "Very Likely" },
  { value: "likely", label: "Likely" },
  { value: "possible", label: "Possible" },
  { value: "unlikely", label: "Unlikely" },
];

const PROTOCOL_OPTIONS = [
  { value: "api", label: "API" },
  { value: "webhook", label: "Webhook" },
  { value: "file_transfer", label: "File Transfer" },
  { value: "database", label: "Database" },
  { value: "middleware", label: "Middleware" },
  { value: "other", label: "Other" },
];

const IMPACT_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS = [
  { value: "technical", label: "Technical" },
  { value: "business", label: "Business" },
  { value: "process", label: "Process" },
  { value: "resource", label: "Resource" },
];

export function FindingEditModal({ finding, isOpen, onClose, onSave }: FindingEditModalProps) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (finding) {
      setFormData({ ...(finding.editedData ?? finding.data) } as Record<string, unknown>);
    }
  }, [finding]);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !finding) return null;

  function updateField(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!finding) return;
    onSave(finding._id, formData);
    onClose();
  }

  const str = (key: string) => (typeof formData[key] === "string" ? (formData[key] as string) : "");

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Edit finding"
      >
        <div
          className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-border-default bg-surface-default shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-default px-6 py-4">
            <h3 className="text-lg font-semibold text-text-heading">Edit Finding</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form body */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-4">
            {finding.type === "requirement" && (
              <>
                <TextField
                  label="Title"
                  value={str("title")}
                  onChange={(v) => updateField("title", v)}
                />
                <TextField
                  label="Description"
                  value={str("description")}
                  onChange={(v) => updateField("description", v)}
                  multiline
                />
                <SelectField
                  label="Priority"
                  value={str("priority") || "should_have"}
                  options={PRIORITY_OPTIONS}
                  onChange={(v) => updateField("priority", v)}
                />
                <SelectField
                  label="Fit/Gap"
                  value={str("fitGap") || "custom_dev"}
                  options={FITGAP_OPTIONS}
                  onChange={(v) => updateField("fitGap", v)}
                />
                <SelectField
                  label="Effort Estimate"
                  value={str("effortEstimate") || "medium"}
                  options={EFFORT_OPTIONS}
                  onChange={(v) => updateField("effortEstimate", v)}
                />
              </>
            )}

            {finding.type === "risk" && (
              <>
                <TextField
                  label="Title"
                  value={str("title")}
                  onChange={(v) => updateField("title", v)}
                />
                <TextField
                  label="Description"
                  value={str("description")}
                  onChange={(v) => updateField("description", v)}
                  multiline
                />
                <SelectField
                  label="Severity"
                  value={str("severity") || "medium"}
                  options={SEVERITY_OPTIONS}
                  onChange={(v) => updateField("severity", v)}
                />
                <SelectField
                  label="Probability"
                  value={str("probability") || "possible"}
                  options={PROBABILITY_OPTIONS}
                  onChange={(v) => updateField("probability", v)}
                />
                <TextField
                  label="Mitigation"
                  value={str("mitigation")}
                  onChange={(v) => updateField("mitigation", v)}
                  multiline
                />
              </>
            )}

            {finding.type === "integration" && (
              <>
                <TextField
                  label="Name"
                  value={str("name")}
                  onChange={(v) => updateField("name", v)}
                />
                <TextField
                  label="Source System"
                  value={str("sourceSystem")}
                  onChange={(v) => updateField("sourceSystem", v)}
                />
                <TextField
                  label="Target System"
                  value={str("targetSystem")}
                  onChange={(v) => updateField("targetSystem", v)}
                />
                <SelectField
                  label="Protocol"
                  value={str("protocol") || str("type") || "api"}
                  options={PROTOCOL_OPTIONS}
                  onChange={(v) => updateField("protocol", v)}
                />
                <TextField
                  label="Description"
                  value={str("description")}
                  onChange={(v) => updateField("description", v)}
                  multiline
                />
              </>
            )}

            {finding.type === "decision" && (
              <>
                <TextField
                  label="Title"
                  value={str("title")}
                  onChange={(v) => updateField("title", v)}
                />
                <TextField
                  label="Description"
                  value={str("description")}
                  onChange={(v) => updateField("description", v)}
                  multiline
                />
                <SelectField
                  label="Impact"
                  value={str("impact") || "medium"}
                  options={IMPACT_OPTIONS}
                  onChange={(v) => updateField("impact", v)}
                />
                <SelectField
                  label="Category"
                  value={str("category") || "technical"}
                  options={CATEGORY_OPTIONS}
                  onChange={(v) => updateField("category", v)}
                />
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-border-default px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-interactive-hover"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
