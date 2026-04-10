"use client";

export type ImportStatus = "draft" | "active" | "deferred";

interface ImportStatusPickerProps {
  value: ImportStatus;
  onChange: (value: ImportStatus) => void;
  disabled?: boolean;
}

export function ImportStatusPicker({ value, onChange, disabled }: ImportStatusPickerProps) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
      Import as
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ImportStatus)}
        disabled={disabled}
        className="select"
      >
        <option value="draft">Draft</option>
        <option value="active">Active</option>
        <option value="deferred">Deferred</option>
      </select>
    </label>
  );
}
