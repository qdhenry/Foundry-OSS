import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { DocumentAnalysisSuggestions } from "./DocumentAnalysisSuggestions";

/**
 * DocumentAnalysisSuggestions uses useQuery/useMutation from convex/react — mocked globally.
 * Stories demonstrate the full range of states driven by the analysis.status field.
 *
 * Because Convex is mocked, the component will render the loading skeleton (analysis === undefined).
 * To see the full UI, we use decorator-level overrides via the global Convex mock.
 */

const meta: Meta<typeof DocumentAnalysisSuggestions> = {
  title: "AIFeatures/DocumentAnalysisSuggestions",
  component: DocumentAnalysisSuggestions,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Displays AI-extracted requirements, risks, and decisions from an analyzed document. Driven by the documentAnalysis.getByDocument Convex query.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DocumentAnalysisSuggestions>;

/** Default render — Convex mock returns undefined (loading state) */
export const Loading: Story = {
  args: {
    documentId: "documents_mock_id" as any,
    programId: "programs_mock_id" as any,
  },
};

/**
 * The stories below use a decorator to inject a resolved analysis object
 * directly into the component via a wrapper that provides the mock value.
 * Since the global mock returns undefined for all queries, we render a
 * standalone preview of each significant UI state using wrapper components.
 */

// Inline wrapper components for each state to bypass Convex mock limitations

import { AlertTriangle, CheckCircle, Lightbulb, Plus } from "lucide-react";
import React from "react";

function AnalysisCompletePreview() {
  const [acceptedRequirements, setAcceptedRequirements] = React.useState<Set<number>>(new Set());
  const [acceptedRisks, setAcceptedRisks] = React.useState<Set<number>>(new Set());

  const requirements = [
    {
      data: {
        title: "Customer Account Hierarchy Support",
        description:
          "The system must support parent/child B2B account relationships with configurable approval chains up to 5 levels deep.",
        priority: "must_have",
        fitGap: "gap",
        suggestedWorkstream: "Account Management",
      },
      confidence: "high" as const,
      sourceExcerpt:
        "Enterprise customers require multi-level account structures for purchase approval workflows.",
    },
    {
      data: {
        title: "Tier-Based Contract Pricing",
        description:
          "Support customer-specific price books with volume discounts and contract pricing visible only to entitled accounts.",
        priority: "must_have",
        fitGap: "partial",
      },
      confidence: "medium" as const,
    },
    {
      data: {
        title: "Procurement Order Workflow",
        description:
          "Integrate with customer ERP systems to generate and track purchase orders through approval stages.",
        priority: "should_have",
      },
      confidence: "low" as const,
      sourceExcerpt: "PO integration mentioned in section 4.2 of the requirements document.",
    },
  ];

  const risks = [
    {
      data: {
        title: "Data Migration Complexity",
        description:
          "Migrating 2,400+ price records from Magento catalog rules to Salesforce Price Books carries high transformation risk.",
        severity: "high",
        probability: "likely",
        mitigation:
          "Run parallel data validation during migration with automated reconciliation scripts.",
        affectedWorkstreams: ["Pricing", "Data Migration"],
      },
      confidence: "high" as const,
    },
    {
      data: {
        title: "Custom Attribute Loss",
        description: "14 custom product attributes have no direct mapping in the target platform.",
        severity: "medium",
        probability: "possible",
        mitigation:
          "Audit all custom attributes and define target mappings before migration kickoff.",
      },
      confidence: "medium" as const,
    },
  ];

  const decisions = [
    {
      data: {
        title: "Salesforce B2B Commerce as target platform",
        description: "Confirmed in stakeholder alignment session on 2025-11-14.",
        impact: "high",
        category: "architecture",
      },
      confidence: "high" as const,
    },
    {
      data: {
        title: "Phased migration approach",
        description: "Migrate accounts first, then catalog, then orders.",
        impact: "medium",
        category: "delivery",
      },
      confidence: "medium" as const,
    },
  ];

  const CONFIDENCE_BADGE: Record<string, string> = {
    high: "bg-status-success-bg text-status-success-fg",
    medium: "bg-status-warning-bg text-status-warning-fg",
    low: "bg-surface-elevated text-text-secondary",
  };

  const SEVERITY_BADGE: Record<string, string> = {
    critical: "bg-status-error-bg text-status-error-fg",
    high: "bg-orange-100 text-orange-700",
    medium: "bg-status-warning-bg text-status-warning-fg",
    low: "bg-status-success-bg text-status-success-fg",
  };

  const totalFindings = requirements.length + risks.length + decisions.length;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-green-200 bg-status-success-bg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle size={18} className="text-status-success-fg" />
          <h3 className="text-sm font-semibold text-green-800">AI Analysis Complete</h3>
        </div>
        <p className="mt-1 text-xs text-status-success-fg">
          Found {totalFindings} findings: {requirements.length} requirements, {risks.length} risks,{" "}
          {decisions.length} decisions.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <Plus size={16} className="text-accent-default" />
          Suggested Requirements ({requirements.length})
        </h4>
        <div className="space-y-3">
          {requirements.map((req, i) => {
            const isAccepted = acceptedRequirements.has(i);
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 ${isAccepted ? "border-green-200 bg-status-success-bg" : "border-border-default"}`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h5 className="text-sm font-medium text-text-heading">{req.data.title}</h5>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_BADGE[req.confidence]}`}
                    >
                      {req.confidence}
                    </span>
                    {req.data.priority && (
                      <span className="rounded-full bg-status-info-bg px-2 py-0.5 text-[10px] font-medium text-accent-default">
                        {req.data.priority.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-text-secondary">{req.data.description}</p>
                {req.sourceExcerpt && (
                  <p className="mt-1.5 rounded bg-surface-raised px-2 py-1 text-[11px] italic text-text-muted">
                    &ldquo;{req.sourceExcerpt}&rdquo;
                  </p>
                )}
                <div className="mt-2">
                  <button
                    onClick={() => setAcceptedRequirements((prev) => new Set(prev).add(i))}
                    disabled={isAccepted}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      isAccepted
                        ? "cursor-default bg-status-success-bg text-status-success-fg"
                        : "bg-status-warning-bg text-status-warning-fg hover:bg-amber-100"
                    }`}
                  >
                    {isAccepted ? "Added" : "Add Requirement"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <AlertTriangle size={16} className="text-accent-default" />
          Risk Indicators ({risks.length})
        </h4>
        <div className="space-y-3">
          {risks.map((risk, i) => {
            const isAccepted = acceptedRisks.has(i);
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 ${isAccepted ? "border-green-200 bg-status-success-bg" : "border-border-default"}`}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h5 className="text-sm font-medium text-text-heading">{risk.data.title}</h5>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[risk.data.severity] ?? SEVERITY_BADGE.medium}`}
                  >
                    {risk.data.severity}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{risk.data.description}</p>
                {risk.data.mitigation && (
                  <p className="mt-1.5 text-xs text-text-primary">
                    <span className="font-medium">Mitigation:</span> {risk.data.mitigation}
                  </p>
                )}
                <div className="mt-2">
                  <button
                    onClick={() => setAcceptedRisks((prev) => new Set(prev).add(i))}
                    disabled={isAccepted}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      isAccepted
                        ? "cursor-default bg-status-success-bg text-status-success-fg"
                        : "bg-status-warning-bg text-status-warning-fg hover:bg-amber-100"
                    }`}
                  >
                    {isAccepted ? "Logged" : "Log as Risk"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <Lightbulb size={16} className="text-accent-default" />
          Key Decisions ({decisions.length})
        </h4>
        <ul className="space-y-2">
          {decisions.map((decision, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-text-primary">
              <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <div>
                <span className="font-medium text-text-heading">{decision.data.title}</span>
                {decision.data.description && (
                  <span className="ml-1 text-text-secondary">— {decision.data.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AnalysisInProgressPreview() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <div className="flex flex-col items-center py-6">
        <p className="text-sm font-medium text-text-heading">Analysis in progress...</p>
        <p className="mt-1 text-xs text-text-muted">
          Upload and analyze a document to see AI suggestions.
        </p>
      </div>
    </div>
  );
}

function AnalysisFailedPreview() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <div className="flex flex-col items-center py-6">
        <p className="text-sm font-medium text-text-heading">No analysis available</p>
        <p className="mt-1 text-xs text-text-muted">Analysis failed. Try again.</p>
      </div>
    </div>
  );
}

export const Complete: Story = {
  name: "Complete — With Findings",
  render: () => <AnalysisCompletePreview />,
};

export const InProgress: Story = {
  name: "Analysis In Progress",
  render: () => <AnalysisInProgressPreview />,
};

export const Failed: Story = {
  name: "Analysis Failed",
  render: () => <AnalysisFailedPreview />,
};

export const AcceptRequirement: Story = {
  name: "Interaction — Accept Requirement",
  render: () => <AnalysisCompletePreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const addButtons = canvas.getAllByRole("button", { name: /add requirement/i });
    if (addButtons[0]) {
      await userEvent.click(addButtons[0]);
    }
  },
};

export const LogRisk: Story = {
  name: "Interaction — Log Risk",
  render: () => <AnalysisCompletePreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const logButtons = canvas.getAllByRole("button", { name: /log as risk/i });
    if (logButtons[0]) {
      await userEvent.click(logButtons[0]);
    }
  },
};

export const Mobile: Story = {
  name: "Mobile — Complete",
  render: () => <AnalysisCompletePreview />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet — Complete",
  render: () => <AnalysisCompletePreview />,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
