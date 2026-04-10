import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { AlertCircle, CheckCircle, GitBranch, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { RequirementRefinementPanel } from "./RequirementRefinementPanel";

const meta: Meta<typeof RequirementRefinementPanel> = {
  title: "AIFeatures/RequirementRefinementPanel",
  component: RequirementRefinementPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "AI-powered requirement refinement panel. Analyzes a requirement for clarity, completeness, testability, and feasibility — then surfaces actionable suggestions.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RequirementRefinementPanel>;

/** Loading — Convex query not yet resolved */
export const Loading: Story = {
  args: {
    requirementId: "requirements_mock_id" as any,
    programId: "programs_mock_id" as any,
  },
};

// Inline previews for states that depend on resolved Convex data

const CATEGORY_BADGE: Record<string, string> = {
  clarity: "bg-status-info-bg text-accent-default",
  completeness: "bg-surface-raised text-text-secondary",
  scope: "bg-status-warning-bg text-status-warning-fg",
  testability: "bg-status-success-bg text-status-success-fg",
  feasibility: "bg-status-warning-bg text-status-warning-fg",
  priority: "bg-orange-100 text-orange-700",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  major: "bg-orange-100 text-orange-700",
  minor: "bg-status-warning-bg text-status-warning-fg",
  suggestion: "bg-surface-raised text-text-secondary",
};

const mockSuggestions = [
  {
    category: "clarity",
    severity: "major",
    suggestion:
      "The acceptance criteria are ambiguous — specify what 'fast response' means in measurable terms (e.g., < 200ms p95 latency).",
    example_resolution:
      "The system shall respond to catalog search queries within 200ms at the 95th percentile under a load of 500 concurrent users.",
  },
  {
    category: "testability",
    severity: "critical",
    suggestion:
      "No testable acceptance criteria defined. Add at least three measurable pass/fail conditions.",
    example_resolution:
      "Given a valid user session, when the user searches for a product SKU, then the result set returns within 200ms and contains the exact SKU match as the first result.",
  },
  {
    category: "completeness",
    severity: "minor",
    suggestion:
      "Edge case for zero-result search is not addressed. Define expected behavior (e.g., show 'no results' message, suggest alternatives).",
    example_resolution: undefined,
  },
  {
    category: "scope",
    severity: "suggestion",
    suggestion:
      "Consider whether mobile-specific search UX requirements should be split into a separate requirement.",
    example_resolution: undefined,
  },
];

const mockSplit = {
  recommended: true,
  rationale:
    "This requirement covers both catalog search and order history search, which have different performance profiles, data sources, and team ownership. Splitting will improve traceability.",
  proposed_parts: [
    {
      title: "Catalog Search Performance",
      description:
        "Search performance requirements for the product catalog — Elasticsearch-backed, p95 < 200ms.",
    },
    {
      title: "Order History Search",
      description:
        "Search requirements for order history — SQL-backed, p95 < 800ms acceptable given data volume.",
    },
  ],
};

function ProcessingPreview() {
  return (
    <div className="rounded-xl border border-blue-200 bg-status-info-bg p-6">
      <div className="flex flex-col items-center py-6">
        <Loader2 size={32} className="mb-3 animate-spin text-accent-default" />
        <p className="text-sm font-medium text-blue-800">Analyzing requirement...</p>
        <p className="mt-1 text-xs text-accent-default">
          AI is evaluating clarity, completeness, and testability. This typically takes 10-30
          seconds.
        </p>
      </div>
    </div>
  );
}

function ErrorPreview() {
  return (
    <div className="rounded-xl border border-red-200 bg-status-error-bg p-6">
      <div className="flex flex-col items-center py-6">
        <AlertCircle size={32} className="mb-3 text-status-error-fg" />
        <p className="text-sm font-medium text-red-800">Refinement analysis failed</p>
        <p className="mt-1 max-w-sm text-center text-xs text-status-error-fg">
          The AI service timed out while analyzing the requirement. Please retry.
        </p>
        <button className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Retry
        </button>
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <div className="flex flex-col items-center py-6">
        <Sparkles size={32} className="mb-3 text-accent-default" />
        <p className="text-sm font-medium text-text-heading">No refinement suggestions yet</p>
        <p className="mt-1 text-xs text-text-muted">
          Request an AI analysis to get improvement suggestions.
        </p>
        <button className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Request Refinement
        </button>
      </div>
    </div>
  );
}

function SuggestionsPreview({ withSplit = false }: { withSplit?: boolean }) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [splitAccepted, setSplitAccepted] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-status-info-bg p-4">
        <h4 className="mb-1 text-sm font-semibold text-blue-800">Overall Assessment</h4>
        <p className="text-xs text-accent-default">
          This requirement has significant clarity and testability gaps. The core business intent is
          clear, but the acceptance criteria need quantifiable metrics before it can be estimated or
          tested reliably.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 text-sm font-semibold text-text-heading">
          Suggestions ({mockSuggestions.length})
        </h4>
        <div className="space-y-3">
          {mockSuggestions.map((item, i) => {
            if (dismissed.has(i)) return null;
            const isApplied = applied.has(i);
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 ${isApplied ? "border-green-200 bg-status-success-bg" : "border-border-default"}`}
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[item.category] ?? CATEGORY_BADGE.clarity}`}
                  >
                    {item.category}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[item.severity] ?? SEVERITY_BADGE.suggestion}`}
                  >
                    {item.severity}
                  </span>
                </div>
                <p className="text-xs text-text-primary">{item.suggestion}</p>
                {item.example_resolution && (
                  <p className="mt-1.5 rounded bg-surface-raised px-2 py-1 text-[11px] text-text-secondary">
                    <span className="font-medium">Example:</span> {item.example_resolution}
                  </p>
                )}
                {!isApplied && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => setApplied((prev) => new Set(prev).add(i))}
                      className="flex items-center gap-1 rounded-lg bg-status-success-bg px-2.5 py-1 text-xs font-medium text-status-success-fg transition-colors hover:bg-green-100"
                    >
                      <CheckCircle size={12} />
                      Apply
                    </button>
                    <button
                      onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                      className="flex items-center gap-1 rounded-lg bg-surface-raised px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated"
                    >
                      <X size={12} />
                      Dismiss
                    </button>
                  </div>
                )}
                {isApplied && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-status-success-fg">
                    <CheckCircle size={12} />
                    Applied
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {withSplit && (
        <div className="rounded-xl border border-amber-200 bg-status-warning-bg p-4">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <GitBranch size={16} />
            Split Recommended
          </h4>
          <p className="mb-3 text-xs text-status-warning-fg">{mockSplit.rationale}</p>
          <div className="mb-3 space-y-2">
            {mockSplit.proposed_parts.map((part, i) => (
              <div key={i} className="rounded-lg border border-amber-200 bg-surface-default p-2.5">
                <p className="text-xs font-medium text-text-heading">{part.title}</p>
                <p className="mt-0.5 text-[11px] text-text-secondary">{part.description}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setSplitAccepted(true)}
            disabled={splitAccepted}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              splitAccepted
                ? "cursor-default bg-status-success-bg text-status-success-fg"
                : "bg-accent-default text-text-on-brand hover:bg-accent-strong"
            }`}
          >
            {splitAccepted ? "Split Accepted" : "Accept Split"}
          </button>
        </div>
      )}

      <div className="flex justify-end">
        <button className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Request Refinement
        </button>
      </div>
    </div>
  );
}

export const Processing: Story = {
  name: "Processing — AI Analyzing",
  render: () => <ProcessingPreview />,
};

export const ErrorState: Story = {
  name: "Error — Analysis Failed",
  render: () => <ErrorPreview />,
};

export const Empty: Story = {
  name: "Empty — No Suggestions Yet",
  render: () => <EmptyPreview />,
};

export const WithSuggestions: Story = {
  name: "Complete — With Suggestions",
  render: () => <SuggestionsPreview />,
};

export const WithSplitRecommendation: Story = {
  name: "Complete — With Split Recommendation",
  render: () => <SuggestionsPreview withSplit />,
};

export const ApplySuggestion: Story = {
  name: "Interaction — Apply Suggestion",
  render: () => <SuggestionsPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const applyButtons = canvas.getAllByRole("button", { name: /apply/i });
    if (applyButtons[0]) {
      await userEvent.click(applyButtons[0]);
    }
  },
};

export const DismissSuggestion: Story = {
  name: "Interaction — Dismiss Suggestion",
  render: () => <SuggestionsPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dismissButtons = canvas.getAllByRole("button", { name: /dismiss/i });
    if (dismissButtons[0]) {
      await userEvent.click(dismissButtons[0]);
    }
  },
};

export const AcceptSplit: Story = {
  name: "Interaction — Accept Split",
  render: () => <SuggestionsPreview withSplit />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const splitButton = canvas.queryByRole("button", { name: /accept split/i });
    if (splitButton) {
      await userEvent.click(splitButton);
    }
  },
};

export const Mobile: Story = {
  name: "Mobile — With Suggestions",
  render: () => <SuggestionsPreview withSplit />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet — With Suggestions",
  render: () => <SuggestionsPreview withSplit />,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
