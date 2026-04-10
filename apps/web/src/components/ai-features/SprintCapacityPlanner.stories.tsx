import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { AlertTriangle, Calendar, Clock, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { SprintCapacityPlanner } from "./SprintCapacityPlanner";

const meta: Meta<typeof SprintCapacityPlanner> = {
  title: "AIFeatures/SprintCapacityPlanner",
  component: SprintCapacityPlanner,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "AI-powered sprint capacity planner. Analyses team capacity and recommends which requirements to include in a sprint based on velocity, skill availability, and dependencies.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SprintCapacityPlanner>;

export const Loading: Story = {
  args: {
    sprintId: "sprints_mock_id" as any,
    programId: "programs_mock_id" as any,
  },
};

// ----------------------------------------------------------------
// Mock data
// ----------------------------------------------------------------

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const mockCapacity = {
  total_hours: 240,
  estimated_points: 48,
  team_allocation: [
    { role: "Senior Engineer", name: "Alex Chen", available_hours: 72, allocated_points: 16 },
    { role: "Engineer", name: "Maria Santos", available_hours: 64, allocated_points: 13 },
    { role: "Engineer", name: "James Okafor", available_hours: 64, allocated_points: 12 },
    { role: "QA Engineer", name: "Priya Nair", available_hours: 40, allocated_points: 7 },
  ],
};

const mockRecommendedTasks = [
  {
    requirement_title: "Customer Account Hierarchy — Database Schema",
    story_points: 8,
    priority: "critical",
    rationale: "Foundation for all B2B account features; blocking 4 downstream requirements.",
  },
  {
    requirement_title: "Tier-Based Pricing: Price Book Import",
    story_points: 5,
    priority: "high",
    rationale: "Unblocks the pricing QA track; dependency on catalog migration already complete.",
  },
  {
    requirement_title: "Search Performance — Elasticsearch Index Rebuild",
    story_points: 8,
    priority: "high",
    rationale: "SLA risk item identified in sprint gate review; must ship before UAT begins.",
  },
  {
    requirement_title: "Order History API — Pagination",
    story_points: 3,
    priority: "medium",
    rationale: "Low-effort, high-value; completes the Order History feature set.",
  },
  {
    requirement_title: "Product Attribute Mapping — Custom Fields",
    story_points: 5,
    priority: "medium",
    rationale: "Resolves 14 unmapped attributes; required for full catalog parity.",
  },
];

const mockDeferredItems = [
  {
    title: "PO Workflow — ERP Integration",
    reason: "External dependency on ERP API credentials not yet received from client.",
  },
  {
    title: "Reorder Functionality — Frontend",
    reason: "Backend Order History API must be completed and QA'd first.",
  },
];

const mockSprintHealth = {
  velocity_confidence: 0.82,
  dependency_risks: [
    "Account hierarchy schema must be merged before pricing work begins in week 2.",
    "Elasticsearch reindex requires DevOps coordination for production index rebuild window.",
  ],
  skill_gaps: [
    "No Salesforce Commerce Cloud architect available until week 3 — may delay PO workflow spike.",
  ],
};

// ----------------------------------------------------------------
// Preview components
// ----------------------------------------------------------------

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <div className="flex flex-col items-center py-6">
        <Calendar size={32} className="mb-3 text-accent-default" />
        <p className="text-sm font-medium text-text-heading">No sprint plan available</p>
        <p className="mt-1 text-xs text-text-muted">
          Generate an AI-powered capacity plan for this sprint.
        </p>
        <button className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Plan Sprint
        </button>
      </div>
    </div>
  );
}

function FullPlanPreview({
  utilization = 75,
  totalPoints = 29,
}: {
  utilization?: number;
  totalPoints?: number;
}) {
  const [planning, setPlanning] = useState(false);

  return (
    <div className="space-y-4">
      {/* Capacity Analysis */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <Users size={16} className="text-accent-default" />
          Capacity Analysis
        </h4>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-secondary">Total Hours</p>
            <p className="text-lg font-bold text-text-heading">{mockCapacity.total_hours}h</p>
          </div>
          <div className="rounded-lg bg-surface-raised p-3">
            <p className="text-xs text-text-secondary">Estimated Points</p>
            <p className="text-lg font-bold text-text-heading">{mockCapacity.estimated_points}</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border-default">
          <table className="w-full text-xs">
            <thead className="bg-surface-raised">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-text-secondary">Role</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Hours</th>
                <th className="px-3 py-2 text-right font-medium text-text-secondary">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {mockCapacity.team_allocation.map((member, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-text-primary">{member.name ?? member.role}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {member.available_hours}h
                  </td>
                  <td className="px-3 py-2 text-right text-text-secondary">
                    {member.allocated_points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommended Tasks */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <TrendingUp size={16} className="text-status-success-fg" />
          Recommended Tasks ({mockRecommendedTasks.length})
        </h4>
        <div className="space-y-2">
          {mockRecommendedTasks.map((task, i) => (
            <div key={i} className="rounded-lg border border-border-default p-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-text-heading">{task.requirement_title}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                    {task.story_points} SP
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.medium}`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-text-secondary">{task.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Deferred Items */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <Clock size={16} className="text-text-muted" />
          Deferred Items ({mockDeferredItems.length})
        </h4>
        <div className="space-y-2">
          {mockDeferredItems.map((item, i) => (
            <div
              key={i}
              className="rounded-lg border border-border-default bg-surface-raised p-2.5"
            >
              <p className="text-xs font-medium text-text-primary">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-text-secondary">{item.reason}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sprint Health */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-heading">
          <AlertTriangle size={16} className="text-status-warning-fg" />
          Sprint Health
        </h4>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-text-secondary">Velocity Confidence</span>
              <span className="font-semibold text-text-heading">
                {Math.round(mockSprintHealth.velocity_confidence * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.round(mockSprintHealth.velocity_confidence * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Dependency Risks</p>
            <ul className="space-y-1">
              {mockSprintHealth.dependency_risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-status-warning-fg">
                  <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-text-secondary">Skill Gaps</p>
            <ul className="space-y-1">
              {mockSprintHealth.skill_gaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-status-error-fg">
                  <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {gap}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-default px-4 py-3">
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>
            <span className="font-semibold text-text-heading">{totalPoints}</span> planned points
          </span>
          <span>
            <span
              className={`font-semibold ${
                utilization > 90
                  ? "text-status-error-fg"
                  : utilization > 75
                    ? "text-status-warning-fg"
                    : "text-status-success-fg"
              }`}
            >
              {Math.round(utilization)}%
            </span>{" "}
            capacity utilization
          </span>
        </div>
        <button
          onClick={() => setPlanning(true)}
          disabled={planning}
          className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          {planning ? "Planning..." : "Plan Sprint"}
        </button>
      </div>
    </div>
  );
}

export const Empty: Story = {
  name: "Empty — No Plan Yet",
  render: () => <EmptyPreview />,
};

export const FullPlan: Story = {
  name: "Complete — Full Capacity Plan",
  render: () => <FullPlanPreview />,
};

export const HighUtilization: Story = {
  name: "Complete — High Utilization (>90%)",
  render: () => <FullPlanPreview utilization={94} totalPoints={45} />,
};

export const MediumUtilization: Story = {
  name: "Complete — Medium Utilization (75-90%)",
  render: () => <FullPlanPreview utilization={82} totalPoints={39} />,
};

export const ClickPlanSprint: Story = {
  name: "Interaction — Click Plan Sprint",
  render: () => <EmptyPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /plan sprint/i });
    await userEvent.click(button);
  },
};

export const Mobile: Story = {
  name: "Mobile — Full Plan",
  render: () => <FullPlanPreview />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet — Full Plan",
  render: () => <FullPlanPreview />,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
