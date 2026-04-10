"use client";

export function WizardStepConfirm({ count }: { count: number }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-text-secondary">Ready to generate and persist this team.</p>
      <p>
        <span className="font-medium">Agents proposed:</span> {count}
      </p>
      <p className="text-text-muted">
        This will call `agentTeam/agents:createBatch` once confirmed.
      </p>
    </div>
  );
}
