import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { AlertTriangle, ArrowRight, CheckCircle, Clock, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { SprintGateEvaluator } from "./SprintGateEvaluator";

const meta: Meta<typeof SprintGateEvaluator> = {
  title: "AIFeatures/SprintGateEvaluator",
  component: SprintGateEvaluator,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "AI-powered sprint gate evaluator. Scores overall readiness, evaluates gate criteria, surfaces critical blockers, and provides a health assessment with next steps.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SprintGateEvaluator>;

export const Loading: Story = {
  args: {
    sprintId: "sprints_mock_id" as any,
    programId: "programs_mock_id" as any,
  },
};

// ----------------------------------------------------------------
// Mock data
// ----------------------------------------------------------------

const VERDICT_BADGE: Record<string, string> = {
  ready: "bg-status-success-bg text-status-success-fg",
  conditional: "bg-status-warning-bg text-status-warning-fg",
  needs_work: "bg-status-error-bg text-status-error-fg",
};

const IMPACT_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string }> = {
  pass: { icon: CheckCircle, color: "text-green-500" },
  fail: { icon: XCircle, color: "text-red-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500" },
  pending: { icon: Clock, color: "text-text-muted" },
};

const mockCriteria = [
  {
    name: "Requirements Coverage",
    status: "pass",
    completion_percent: 94,
    blockers: [],
  },
  {
    name: "Test Coverage",
    status: "warning",
    completion_percent: 62,
    blockers: [
      "Integration test suite not yet written for catalog sync module.",
      "Order history API endpoint missing unit tests.",
    ],
  },
  {
    name: "Security Review",
    status: "pass",
    completion_percent: 100,
    blockers: [],
  },
  {
    name: "Performance Benchmarks",
    status: "fail",
    completion_percent: 40,
    blockers: [
      "Catalog search p95 latency at 480ms — SLA requires < 200ms.",
      "No load test results for the account hierarchy API.",
    ],
  },
  {
    name: "Documentation",
    status: "pending",
    completion_percent: 55,
    blockers: [],
  },
];

const mockBlockers = [
  {
    description: "Catalog search p95 latency is 480ms against a 200ms SLA target.",
    impact_level: "critical",
    resolution_suggestion:
      "Re-run Elasticsearch index optimization and add result caching for top-1000 queries. Re-benchmark before gate re-evaluation.",
    estimated_fix_time: "3 days",
  },
  {
    description: "Integration test coverage is at 62% against the 90% gate requirement.",
    impact_level: "high",
    resolution_suggestion:
      "Prioritize integration tests for catalog sync and order history modules in the current sprint. Pair QA engineer with feature developers.",
    estimated_fix_time: "5 days",
  },
];

const mockRecommendations = [
  "Address the performance blocker before requesting a re-evaluation — it is the only critical gate failure.",
  "Consider a conditional gate pass if test coverage reaches 80% with a committed plan to reach 90% before UAT.",
  "Schedule a focused testing day with the full team to close the test coverage gap.",
];

const mockNextSteps = [
  "Run Elasticsearch index optimization script in staging environment.",
  "Assign integration test writing tasks to Maria and James for catalog sync module.",
  "Re-evaluate gate after performance benchmark re-run (target: Wednesday EOD).",
  "Present conditional approval proposal to program sponsor.",
];

// ----------------------------------------------------------------
// Preview components
// ----------------------------------------------------------------

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <div className="flex flex-col items-center py-6">
        <ShieldCheck size={32} className="mb-3 text-text-muted" />
        <p className="text-sm font-medium text-text-heading">No gate evaluation available</p>
        <p className="mt-1 text-xs text-text-muted">
          Run an AI-powered sprint gate readiness check.
        </p>
        <button className="mt-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700">
          Evaluate Gate
        </button>
      </div>
    </div>
  );
}

function EvaluationPreview({
  readiness = 68,
  verdict = "conditional",
}: {
  readiness?: number;
  verdict?: "ready" | "conditional" | "needs_work";
}) {
  const [evaluating, setEvaluating] = useState(false);

  const readinessColor =
    readiness >= 80
      ? "text-status-success-fg"
      : readiness >= 50
        ? "text-status-warning-fg"
        : "text-status-error-fg";

  const readinessBarColor =
    readiness >= 80 ? "bg-green-500" : readiness >= 50 ? "bg-amber-500" : "bg-red-500";

  const teamConfidence = 0.71;

  return (
    <div className="space-y-4">
      {/* Readiness Score */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-heading">Overall Readiness</h4>
          <span className={`text-2xl font-bold ${readinessColor}`}>{Math.round(readiness)}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className={`h-full rounded-full transition-all ${readinessBarColor}`}
            style={{ width: `${Math.min(readiness, 100)}%` }}
          />
        </div>
      </div>

      {/* Gate Criteria */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 text-sm font-semibold text-text-heading">
          Gate Criteria ({mockCriteria.length})
        </h4>
        <div className="space-y-3">
          {mockCriteria.map((criterion, i) => {
            const statusInfo = STATUS_CONFIG[criterion.status] ?? STATUS_CONFIG.pending;
            const Icon = statusInfo.icon;
            return (
              <div key={i} className="rounded-lg border border-border-default p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={statusInfo.color} />
                    <p className="text-xs font-medium text-text-heading">{criterion.name}</p>
                  </div>
                  <span className="text-xs font-semibold text-text-secondary">
                    {Math.round(criterion.completion_percent)}%
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
                  <div
                    className={`h-full rounded-full ${
                      criterion.status === "pass"
                        ? "bg-green-500"
                        : criterion.status === "warning"
                          ? "bg-amber-500"
                          : criterion.status === "fail"
                            ? "bg-red-500"
                            : "bg-surface-elevated"
                    }`}
                    style={{ width: `${Math.min(criterion.completion_percent, 100)}%` }}
                  />
                </div>
                {criterion.blockers && criterion.blockers.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {criterion.blockers.map((blocker, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-1.5 text-[11px] text-status-error-fg"
                      >
                        <XCircle size={10} className="mt-0.5 shrink-0" />
                        {blocker}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Critical Blockers */}
      {mockBlockers.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-status-error-bg p-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-red-800">
            <XCircle size={16} />
            Critical Blockers ({mockBlockers.length})
          </h4>
          <div className="space-y-3">
            {mockBlockers.map((blocker, i) => (
              <div key={i} className="rounded-lg border border-red-200 bg-surface-default p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${IMPACT_BADGE[blocker.impact_level] ?? IMPACT_BADGE.medium}`}
                  >
                    {blocker.impact_level}
                  </span>
                  {blocker.estimated_fix_time && (
                    <span className="text-[10px] text-text-muted">
                      ~{blocker.estimated_fix_time}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-primary">{blocker.description}</p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  <span className="font-medium">Resolution:</span> {blocker.resolution_suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Assessment */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 text-sm font-semibold text-text-heading">Health Assessment</h4>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Verdict:</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_BADGE[verdict] ?? VERDICT_BADGE.needs_work}`}
            >
              {verdict === "ready"
                ? "Ready"
                : verdict === "conditional"
                  ? "Conditional"
                  : "Needs Work"}
            </span>
          </div>
          <p className="text-xs text-text-primary">
            The sprint is close to ready but two significant gaps — performance and test coverage —
            must be addressed before a clean gate pass. A conditional pass is viable if blockers are
            committed to resolution plans with clear owners.
          </p>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-secondary">Team Confidence</span>
              <span className="font-semibold text-text-heading">
                {Math.round(teamConfidence * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${Math.round(teamConfidence * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            <span className="font-medium">Schedule Impact:</span> If blockers are resolved within 5
            days, sprint delivery date is not at risk.
          </p>
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

      {/* Next Steps */}
      <div className="rounded-xl border border-blue-200 bg-status-info-bg p-4">
        <h4 className="mb-2 text-sm font-semibold text-blue-800">Next Steps</h4>
        <ul className="space-y-1.5">
          {mockNextSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-accent-default">
              <ArrowRight size={10} className="mt-0.5 shrink-0" />
              {step}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setEvaluating(true)}
          disabled={evaluating}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          {evaluating ? "Evaluating..." : "Evaluate Gate"}
        </button>
      </div>
    </div>
  );
}

export const Empty: Story = {
  name: "Empty — No Evaluation Yet",
  render: () => <EmptyPreview />,
};

export const ConditionalPass: Story = {
  name: "Conditional Pass (68%)",
  render: () => <EvaluationPreview readiness={68} verdict="conditional" />,
};

export const Ready: Story = {
  name: "Ready (92%)",
  render: () => <EvaluationPreview readiness={92} verdict="ready" />,
};

export const NeedsWork: Story = {
  name: "Needs Work (34%)",
  render: () => <EvaluationPreview readiness={34} verdict="needs_work" />,
};

export const ClickEvaluate: Story = {
  name: "Interaction — Click Evaluate Gate",
  render: () => <EmptyPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /evaluate gate/i });
    await userEvent.click(button);
  },
};

export const Mobile: Story = {
  name: "Mobile — Conditional Pass",
  render: () => <EvaluationPreview readiness={68} verdict="conditional" />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet — Conditional Pass",
  render: () => <EvaluationPreview readiness={68} verdict="conditional" />,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
