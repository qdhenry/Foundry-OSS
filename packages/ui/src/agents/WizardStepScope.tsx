"use client";

export function WizardStepScope({
  customContext,
  onChange,
}: {
  customContext: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="font-medium text-text-heading">Scope</h4>
      <textarea
        value={customContext}
        onChange={(event) => onChange(event.target.value)}
        className="h-28 w-full rounded-md border border-border-default bg-surface-subtle p-2 text-sm"
        placeholder="Add project context for generation"
      />
    </div>
  );
}
