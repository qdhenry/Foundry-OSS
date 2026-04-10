import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { AlertTriangle, ChevronRight, Shield, TrendingUp, Zap } from "lucide-react";
import React from "react";
import { RiskAssessmentPanel } from "./RiskAssessmentPanel";

const meta: Meta<typeof RiskAssessmentPanel> = {
  title: "AIFeatures/RiskAssessmentPanel",
  component: RiskAssessmentPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "AI-powered risk assessment panel. Surfaces new risks, escalations, cascade impacts, and recommendations following a change event or manual evaluation request.",
      },
    },
  },
  argTypes: {
    changeType: { control: "text" },
    changeContext: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof RiskAssessmentPanel>;

/** Loading — Convex query not yet resolved */
export const Loading: Story = {
  args: {
    programId: "programs_mock_id" as any,
  },
};

// ----------------------------------------------------------------
// Inline preview components for resolved states
// ----------------------------------------------------------------

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const PROBABILITY_BADGE: Record<string, string> = {
  very_likely: "bg-status-error-bg text-status-error-fg",
  likely: "bg-orange-50 text-orange-600",
  possible: "bg-status-warning-bg text-status-warning-fg",
  unlikely: "bg-surface-raised text-text-secondary",
};

const mockNewRisks = [
  {
    title: "Real-Time Sync Latency Under Peak Load",
    severity: "high",
    probability: "likely",
    description:
      "The new catalog sync architecture pushes changes via webhook to 3 downstream systems. Under peak load (Black Friday), propagation latency may exceed the 5-second SLA.",
    mitigation:
      "Introduce an async queue (SQS or Convex scheduler) with back-pressure handling and alerting at 80% queue depth.",
  },
  {
    title: "B2B Account Hierarchy Data Loss During Migration",
    severity: "critical",
    probability: "possible",
    description:
      "Parent-child account relationships stored as flat Magento customer groups may not survive automated migration scripts without explicit mapping rules.",
    mitigation:
      "Build a pre-migration audit script that validates all account relationships; require manual sign-off before proceeding.",
  },
  {
    title: "Custom Attribute Mapping Gaps",
    severity: "medium",
    probability: "very_likely",
    description:
      "14 custom Magento product attributes have no direct mapping in Salesforce B2B Commerce standard catalog.",
    mitigation:
      "Conduct attribute audit and define custom field strategy before catalog migration sprint.",
  },
];

const mockEscalations = [
  {
    existing_risk_id: "RISK-0023",
    new_severity: "critical",
    rationale:
      "Following the decision to go live 6 weeks earlier than planned, the previously-medium risk around incomplete regression testing is now critical — test coverage is at 62% against a 90% requirement.",
  },
];

const mockCascadeImpacts = [
  {
    impact_type: "schedule",
    affected_area: "Data Migration Workstream",
    description:
      "The new account hierarchy requirement adds an estimated 3 sprints of data transformation work, pushing the Data Migration workstream completion to Q3 2026.",
  },
  {
    impact_type: "cost",
    affected_area: "Integration Budget",
    description:
      "PO workflow custom development will require 2 additional Salesforce Commerce Cloud licenses and ~$40K in professional services.",
  },
];

const mockRecommendations = [
  "Schedule a dedicated risk review session with technical leads before the next sprint planning.",
  "Add real-time sync latency monitoring to the sprint gate criteria for the Integration workstream.",
  "Escalate the account hierarchy data loss risk to executive sponsor — requires architectural decision.",
  "Create spike tasks to prototype the async queue solution for catalog sync before committing to the architecture.",
];

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <div className="flex flex-col items-center py-6">
        <Shield size={32} className="mb-3 text-accent-default" />
        <p className="text-sm font-medium text-text-heading">No risk assessment available</p>
        <p className="mt-1 text-xs text-text-muted">
          Run an AI-powered risk evaluation for this program.
        </p>
        <button className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Evaluate Risks
        </button>
      </div>
    </div>
  );
}

function FullAssessmentPreview({
  impactSummaryType = "string",
}: {
  impactSummaryType?: "string" | "object";
}) {
  const [evaluating, setEvaluating] = React.useState(false);

  const impactSummary =
    impactSummaryType === "object"
      ? {
          overall_risk_level: "high",
          confidence: "medium",
          summary:
            "The accelerated go-live date and new account hierarchy requirement introduce two high-severity risks that require immediate architectural decisions.",
        }
      : "The accelerated go-live date and new account hierarchy requirement introduce two high-severity risks that require immediate architectural decisions.";

  return (
    <div className="space-y-4">
      {/* Change Impact Summary */}
      <div className="rounded-xl border border-amber-200 bg-status-warning-bg p-4">
        <h4 className="mb-1 text-sm font-semibold text-amber-800">Change Impact Summary</h4>
        <p className="text-xs text-status-warning-fg">
          {typeof impactSummary === "string" ? impactSummary : impactSummary.summary}
        </p>
        {typeof impactSummary === "object" && (
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[impactSummary.overall_risk_level] ?? SEVERITY_BADGE.medium}`}
            >
              {impactSummary.overall_risk_level}
            </span>
            <span className="text-[10px] text-status-warning-fg">
              Confidence: {impactSummary.confidence}
            </span>
          </div>
        )}
      </div>

      {/* New Risks */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <AlertTriangle size={16} className="text-status-error-fg" />
          New Risks ({mockNewRisks.length})
        </h4>
        <div className="space-y-3">
          {mockNewRisks.map((risk, i) => (
            <div key={i} className="rounded-lg border border-border-default p-3">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <h5 className="text-xs font-medium text-text-heading">{risk.title}</h5>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[risk.severity] ?? SEVERITY_BADGE.medium}`}
                  >
                    {risk.severity}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PROBABILITY_BADGE[risk.probability] ?? PROBABILITY_BADGE.possible}`}
                  >
                    {risk.probability}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-text-secondary">{risk.description}</p>
              {risk.mitigation && (
                <p className="mt-1.5 text-[11px] text-text-primary">
                  <span className="font-medium">Mitigation:</span> {risk.mitigation}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Escalations */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <TrendingUp size={16} className="text-orange-500" />
          Escalations ({mockEscalations.length})
        </h4>
        <div className="space-y-2">
          {mockEscalations.map((esc, i) => (
            <div key={i} className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[10px] text-text-secondary">
                  {esc.existing_risk_id}
                </span>
                <ChevronRight size={12} className="text-text-muted" />
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SEVERITY_BADGE[esc.new_severity] ?? SEVERITY_BADGE.medium}`}
                >
                  {esc.new_severity}
                </span>
              </div>
              <p className="text-[11px] text-text-primary">{esc.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cascade Impacts */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <Zap size={16} className="text-emerald-500" />
          Cascade Impacts ({mockCascadeImpacts.length})
        </h4>
        <div className="space-y-2">
          {mockCascadeImpacts.map((impact, i) => (
            <div key={i} className="rounded-lg border border-border-default p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-medium text-status-success-fg">
                  {impact.impact_type}
                </span>
                <span className="text-[11px] text-text-muted">{impact.affected_area}</span>
              </div>
              <p className="text-[11px] text-text-primary">{impact.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border border-green-200 bg-status-success-bg p-4">
        <h4 className="mb-2 text-sm font-semibold text-green-800">Recommendations</h4>
        <ul className="space-y-1.5">
          {mockRecommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-status-success-fg">
              <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
              {rec}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setEvaluating(true)}
          disabled={evaluating}
          className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {evaluating ? "Evaluating..." : "Evaluate Risks"}
        </button>
      </div>
    </div>
  );
}

export const Empty: Story = {
  name: "Empty — No Assessment Yet",
  render: () => <EmptyPreview />,
};

export const FullAssessment: Story = {
  name: "Complete — Full Assessment",
  render: () => <FullAssessmentPreview />,
};

export const WithObjectSummary: Story = {
  name: "Complete — Structured Impact Summary",
  render: () => <FullAssessmentPreview impactSummaryType="object" />,
};

export const ClickEvaluate: Story = {
  name: "Interaction — Click Evaluate Risks",
  render: () => <EmptyPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /evaluate risks/i });
    await userEvent.click(button);
  },
};

export const Mobile: Story = {
  name: "Mobile — Full Assessment",
  render: () => <FullAssessmentPreview />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet — Full Assessment",
  render: () => <FullAssessmentPreview />,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
