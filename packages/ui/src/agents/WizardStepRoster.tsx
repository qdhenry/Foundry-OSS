"use client";

export function WizardStepRoster({ roster }: { roster: any[] }) {
  if (roster.length === 0) {
    return <p className="text-sm text-text-secondary">No roster generated yet.</p>;
  }

  return (
    <div className="space-y-2">
      {roster.map((agent) => (
        <div key={agent.name} className="rounded-lg border border-border-default p-2 text-sm">
          <div className="font-medium text-text-heading">{agent.name}</div>
          <div className="text-text-secondary">{agent.role}</div>
        </div>
      ))}
    </div>
  );
}
