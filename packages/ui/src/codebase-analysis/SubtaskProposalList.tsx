"use client";

import { ArrowRight, Check, Pencil, Plus, SkipForward, X } from "lucide-react";
import { useState } from "react";

interface SubtaskProposal {
  _id: string;
  subtaskId?: string;
  proposalType: string;
  currentState?: { title: string; description: string; prompt: string; status: string };
  proposedState: { title?: string; description?: string; prompt?: string; status?: string };
  reasoning: string;
  evidence: { files: Array<{ filePath: string; snippet?: string }> };
  reviewStatus: string;
}

interface SubtaskProposalListProps {
  proposals: SubtaskProposal[];
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
  onBulkApprove: (proposalIds: string[]) => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  status_change: <ArrowRight className="h-4 w-4 text-status-success-fg" />,
  rewrite: <Pencil className="h-4 w-4 text-status-warning-fg" />,
  new_subtask: <Plus className="h-4 w-4 text-accent-default" />,
  skip: <SkipForward className="h-4 w-4 text-text-muted" />,
};

const TYPE_LABEL: Record<string, string> = {
  status_change: "Status Change",
  rewrite: "Rewrite Prompt",
  new_subtask: "New Subtask",
  skip: "Skip",
};

export function SubtaskProposalList({
  proposals,
  onApprove,
  onReject,
  onBulkApprove,
}: SubtaskProposalListProps) {
  const [_expandedId, _setExpandedId] = useState<string | null>(null);
  const pending = proposals.filter((p) => p.reviewStatus === "pending");

  if (proposals.length === 0) {
    return <p className="py-4 text-center text-sm text-text-muted">No subtask changes proposed.</p>;
  }

  return (
    <div className="space-y-3">
      {pending.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={() => onBulkApprove(pending.map((p) => p._id))}
            className="flex items-center gap-1 rounded-md bg-status-success-bg px-3 py-1 text-xs font-medium text-status-success-fg hover:opacity-80"
          >
            <Check className="h-3 w-3" />
            Approve All ({pending.length})
          </button>
        </div>
      )}

      {proposals.map((proposal) => (
        <div
          key={proposal._id}
          className="rounded-lg border border-border-default bg-surface-default"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {TYPE_ICON[proposal.proposalType]}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded bg-surface-raised px-1.5 py-0.5 text-xs font-medium text-text-secondary">
                  {TYPE_LABEL[proposal.proposalType] ?? proposal.proposalType}
                </span>
                {proposal.currentState && (
                  <span className="text-xs text-text-muted">{proposal.currentState.title}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-text-secondary">{proposal.reasoning}</p>
            </div>

            {proposal.reviewStatus === "pending" && (
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => onApprove(proposal._id)}
                  className="rounded-md p-1.5 text-status-success-fg hover:bg-status-success-bg"
                  title="Approve"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onReject(proposal._id)}
                  className="rounded-md p-1.5 text-status-error-fg hover:bg-status-error-bg"
                  title="Reject"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {proposal.reviewStatus === "approved" && (
              <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-xs text-status-success-fg">
                Approved
              </span>
            )}
            {proposal.reviewStatus === "rejected" && (
              <span className="rounded-full bg-status-error-bg px-2 py-0.5 text-xs text-status-error-fg">
                Rejected
              </span>
            )}
          </div>

          {/* Diff preview for rewrites */}
          {proposal.proposalType === "rewrite" &&
            proposal.currentState &&
            proposal.proposedState.prompt && (
              <div className="border-t border-border-default px-4 py-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-status-error-fg">
                      Current Prompt
                    </p>
                    <pre className="overflow-x-auto rounded bg-surface-raised p-2 text-xs text-text-secondary">
                      {proposal.currentState.prompt}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-status-success-fg">
                      Proposed Prompt
                    </p>
                    <pre className="overflow-x-auto rounded bg-surface-raised p-2 text-xs text-text-primary">
                      {proposal.proposedState.prompt}
                    </pre>
                  </div>
                </div>
              </div>
            )}
        </div>
      ))}
    </div>
  );
}
