"use client";

import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { WizardStepConfirm } from "./WizardStepConfirm";
import { WizardStepRoster } from "./WizardStepRoster";
import { WizardStepScope } from "./WizardStepScope";

export function GenerateWizard({
  orgId,
  programId,
  onClose,
  onComplete,
}: {
  orgId: string;
  programId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(1);
  const [customContext, setCustomContext] = useState("");
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const generate = useAction("agentTeam/generation:generateTeamProposal" as any);
  const createBatch = useMutation("agentTeam/agents:createBatch" as any);

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generate({ orgId, programId: programId as any, customContext });
      setRoster(result.proposal.roster ?? []);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    const VALID_MODELS = new Set([
      "claude-opus-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-5-20250514",
    ]);
    const VALID_ROLES = new Set([
      "architect",
      "backend_engineer",
      "frontend_engineer",
      "fullstack_engineer",
      "qa_engineer",
      "devops",
      "reviewer",
      "project_manager",
      "integration_specialist",
      "orchestrator",
    ]);
    try {
      await createBatch({
        orgId,
        programId: programId as any,
        agents: roster.map((agent) => ({
          ...agent,
          model: VALID_MODELS.has(agent.model) ? agent.model : "claude-sonnet-4-5-20250929",
          role: VALID_ROLES.has(agent.role) ? agent.role : "fullstack_engineer",
          avatarSeed: agent.name,
          personalityProfile: undefined,
          skillIds: [],
          workstreamIds: undefined,
          tokenBudget: { perExecution: 12000, perDay: 150000 },
        })),
      });
      onComplete();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-border-default bg-surface-default p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-heading">Generate Agent Team</h3>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        {step === 1 && (
          <WizardStepScope customContext={customContext} onChange={setCustomContext} />
        )}
        {step === 2 && <WizardStepRoster roster={roster} />}
        {step === 3 && <WizardStepConfirm count={roster.length} />}

        <div className="mt-4 flex justify-end gap-2">
          {step > 1 && (
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={loading}
              onClick={handleGenerate}
            >
              {loading ? "Generating…" : "Generate roster"}
            </button>
          )}
          {step === 2 && (
            <button type="button" className="btn-primary btn-sm" onClick={() => setStep(3)}>
              Continue
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={loading}
              onClick={handleConfirm}
            >
              {loading ? "Saving…" : "Create agents"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
