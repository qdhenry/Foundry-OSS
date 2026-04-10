import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  CheckSquare,
  ListTodo,
  Loader2,
  XCircle,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { TaskDecompositionPanel } from "./TaskDecompositionPanel";

const meta: Meta<typeof TaskDecompositionPanel> = {
  title: "AIFeatures/TaskDecompositionPanel",
  component: TaskDecompositionPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "AI-powered task decomposition panel. Breaks a requirement into discrete, estimable tasks with story points, types, dependencies, owner roles, and acceptance criteria.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TaskDecompositionPanel>;

export const Loading: Story = {
  args: {
    requirementId: "requirements_mock_id" as any,
    programId: "programs_mock_id" as any,
  },
};

// ----------------------------------------------------------------
// Mock data
// ----------------------------------------------------------------

const TASK_TYPE_BADGE: Record<string, string> = {
  development: "bg-status-info-bg text-accent-default",
  testing: "bg-status-success-bg text-status-success-fg",
  design: "bg-status-success-bg text-status-success-fg",
  configuration: "bg-status-warning-bg text-status-warning-fg",
  integration: "bg-status-warning-bg text-status-warning-fg",
  documentation: "bg-surface-raised text-text-secondary",
  research: "bg-status-info-bg text-status-info-fg",
  review: "bg-orange-100 text-orange-700",
};

const mockTasks = [
  {
    task_number: 1,
    title: "Design B2B Account Hierarchy Database Schema",
    description:
      "Create the database schema for parent/child account relationships. Define foreign keys, indexes, and cascade rules. Include ERD documentation.",
    story_points: 5,
    task_type: "design",
    depends_on: [],
    suggested_owner_role: "Senior Engineer",
    acceptance_criteria: [
      "ERD approved by technical lead.",
      "Schema supports up to 5 levels of account nesting.",
      "Migration script validates referential integrity on all existing accounts.",
    ],
  },
  {
    task_number: 2,
    title: "Implement Account Hierarchy API Endpoints",
    description:
      "Build REST endpoints for creating, reading, updating, and deleting account hierarchy relationships. Include pagination and filtering by parent account.",
    story_points: 8,
    task_type: "development",
    depends_on: [1],
    suggested_owner_role: "Senior Engineer",
    acceptance_criteria: [
      "GET /accounts/:id/children returns paginated child accounts.",
      "POST /accounts/:id/parent sets parent account with validation.",
      "DELETE /accounts/:id/parent removes hierarchy link without deleting accounts.",
      "All endpoints return 403 for cross-org requests.",
    ],
  },
  {
    task_number: 3,
    title: "Write Integration Tests for Account Hierarchy API",
    description:
      "Cover all API endpoints with integration tests. Include edge cases: circular reference prevention, orphan detection, max-depth enforcement.",
    story_points: 3,
    task_type: "testing",
    depends_on: [2],
    suggested_owner_role: "QA Engineer",
    acceptance_criteria: [
      "Minimum 90% code coverage on hierarchy module.",
      "Circular reference test cases included.",
      "Max-depth (5 levels) enforcement verified.",
    ],
  },
  {
    task_number: 4,
    title: "Build Account Hierarchy UI Component",
    description:
      "Implement the tree-view React component for visualising and editing account hierarchy. Support drag-and-drop reordering and inline editing.",
    story_points: 8,
    task_type: "development",
    depends_on: [2],
    suggested_owner_role: "Engineer",
    acceptance_criteria: [
      "Tree renders correctly for hierarchies up to 5 levels.",
      "Drag-and-drop triggers API update with optimistic UI.",
      "Loading and error states handled.",
    ],
  },
  {
    task_number: 5,
    title: "Data Migration Script — Flat Groups to Hierarchy",
    description:
      "Write and test the one-time migration script that maps Magento customer groups to the new B2B account hierarchy structure.",
    story_points: 5,
    task_type: "integration",
    depends_on: [1],
    suggested_owner_role: "Senior Engineer",
    acceptance_criteria: [
      "All 2,400 existing accounts migrated without data loss.",
      "Rollback script available and tested.",
      "Migration run time < 10 minutes on production dataset.",
    ],
  },
  {
    task_number: 6,
    title: "Update API Documentation",
    description:
      "Add OpenAPI spec entries for all new account hierarchy endpoints. Update the developer guide with usage examples.",
    story_points: 2,
    task_type: "documentation",
    depends_on: [2],
    suggested_owner_role: "Engineer",
    acceptance_criteria: [
      "OpenAPI spec merged to main before sprint close.",
      "Developer guide includes at least two request/response examples per endpoint.",
    ],
  },
];

const mockRationale =
  "This requirement spans three distinct concerns: data persistence (schema + migration), API surface (CRUD endpoints), and frontend interaction. " +
  "The decomposition follows a dependency-first order — schema must be complete before API work begins, and API must be stable before UI and migration work can proceed in parallel. " +
  "Testing and documentation are scoped as explicit tasks rather than embedded to ensure they are tracked and estimated independently.";

const mockCriticalConsiderations = [
  "The migration script (task 5) is irreversible in production — require a dry-run sign-off from the program sponsor before execution.",
  "Task 4 (UI component) and task 5 (migration) can proceed in parallel once task 2 is merged.",
  "Circular reference prevention in task 3 is non-negotiable — a bug here would corrupt the entire account hierarchy.",
];

// ----------------------------------------------------------------
// Preview components
// ----------------------------------------------------------------

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <div className="flex flex-col items-center py-6">
        <ListTodo size={32} className="mb-3 text-accent-default" />
        <p className="text-sm font-medium text-text-heading">No task breakdown available</p>
        <p className="mt-1 text-xs text-text-muted">
          Generate an AI-powered task decomposition for this requirement.
        </p>
        <button className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Generate Tasks
        </button>
      </div>
    </div>
  );
}

function ProcessingPreview() {
  return (
    <div className="rounded-xl border border-blue-200 bg-status-info-bg p-6">
      <div className="flex flex-col items-center py-6">
        <Loader2 size={32} className="mb-3 animate-spin text-accent-default" />
        <p className="text-sm font-medium text-blue-800">Generating task decomposition...</p>
        <p className="mt-1 text-xs text-accent-default">
          AI is analyzing the requirement and generating tasks. This typically takes 10-30 seconds.
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
        <p className="text-sm font-medium text-red-800">Task generation failed</p>
        <p className="mt-1 max-w-sm text-center text-xs text-status-error-fg">
          The AI service encountered an error while generating tasks. Please retry.
        </p>
        <button className="mt-4 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Retry
        </button>
      </div>
    </div>
  );
}

function AcceptedPreview() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-green-200 bg-status-success-bg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle size={18} className="text-status-success-fg" />
          <div>
            <p className="text-sm font-medium text-green-800">Tasks created and added to backlog</p>
            <p className="text-xs text-status-success-fg">
              Navigate to the Tasks page to view and manage the generated tasks.
            </p>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Re-generate Tasks
        </button>
      </div>
    </div>
  );
}

function DecompositionPreview({
  isRejected = false,
  showCriticalConsiderations = true,
}: {
  isRejected?: boolean;
  showCriticalConsiderations?: boolean;
}) {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(isRejected);

  const totalPoints = mockTasks.reduce((sum, t) => sum + t.story_points, 0);

  function toggleTask(index: number) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (accepted) {
    return <AcceptedPreview />;
  }

  return (
    <div className="space-y-4">
      {rejected && (
        <div className="rounded-xl border border-border-default bg-surface-raised p-3">
          <p className="text-xs text-text-secondary">
            This decomposition was rejected. You can review it below or generate a new one.
          </p>
        </div>
      )}

      {/* Rationale */}
      <div className="rounded-xl border border-blue-200 bg-status-info-bg p-4">
        <h4 className="mb-1 text-sm font-semibold text-blue-800">Decomposition Rationale</h4>
        <p className="text-xs text-accent-default">{mockRationale}</p>
      </div>

      {/* Critical Considerations */}
      {showCriticalConsiderations && (
        <div className="rounded-xl border border-amber-200 bg-status-warning-bg p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Zap size={14} />
            Critical Considerations
          </h4>
          <ul className="space-y-1">
            {mockCriticalConsiderations.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-status-warning-fg">
                <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Task List */}
      <div className="rounded-xl border border-border-default bg-surface-default p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-text-heading">Tasks ({mockTasks.length})</h4>
          {!rejected && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setRejecting(true);
                  setTimeout(() => {
                    setRejected(true);
                    setRejecting(false);
                  }, 600);
                }}
                disabled={rejecting}
                className="flex items-center gap-1 rounded-lg bg-surface-raised px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated disabled:opacity-50"
              >
                <XCircle size={12} />
                {rejecting ? "Rejecting..." : "Reject"}
              </button>
              <button
                onClick={() => {
                  setAccepting(true);
                  setTimeout(() => {
                    setAccepted(true);
                    setAccepting(false);
                  }, 600);
                }}
                disabled={accepting}
                className="flex items-center gap-1 rounded-lg bg-accent-default px-3 py-1 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong disabled:opacity-50"
              >
                <CheckCircle size={12} />
                {accepting ? "Accepting..." : "Accept All Tasks"}
              </button>
            </div>
          )}
        </div>
        <div className="space-y-3">
          {mockTasks.map((task, i) => {
            const isSelected = selectedTasks.has(i);
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 ${isSelected ? "border-green-200 bg-status-success-bg" : "border-border-default"}`}
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => toggleTask(i)}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-border-default"
                      }`}
                    >
                      {isSelected && <CheckSquare size={10} />}
                    </button>
                    <div>
                      <p className="text-xs font-medium text-text-heading">
                        <span className="mr-1.5 text-text-muted">#{task.task_number}</span>
                        {task.title}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                      {task.story_points} SP
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TASK_TYPE_BADGE[task.task_type] ?? TASK_TYPE_BADGE.development}`}
                    >
                      {task.task_type}
                    </span>
                  </div>
                </div>
                <p className="ml-6 text-[11px] text-text-secondary">{task.description}</p>
                {task.depends_on && task.depends_on.length > 0 && (
                  <div className="ml-6 mt-1.5 flex items-center gap-1 text-[11px] text-text-muted">
                    <ArrowRight size={10} />
                    Depends on: {task.depends_on.map((d) => `#${d}`).join(", ")}
                  </div>
                )}
                {task.suggested_owner_role && (
                  <p className="ml-6 mt-1 text-[11px] text-text-muted">
                    Owner: {task.suggested_owner_role}
                  </p>
                )}
                {task.acceptance_criteria && task.acceptance_criteria.length > 0 && (
                  <ul className="ml-6 mt-1.5 space-y-0.5">
                    {task.acceptance_criteria.map((ac, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-1.5 text-[11px] text-text-secondary"
                      >
                        <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                        {ac}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary footer */}
      <div className="flex items-center justify-between rounded-xl border border-border-default bg-surface-default px-4 py-3">
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>
            <span className="font-semibold text-text-heading">{totalPoints}</span> total points
          </span>
          <span>
            <span className="font-semibold text-text-heading">2</span> estimated sprints
          </span>
        </div>
        <button className="rounded-lg bg-accent-default px-3 py-1.5 text-xs font-medium text-text-on-brand transition-colors hover:bg-accent-strong">
          Re-generate Tasks
        </button>
      </div>
    </div>
  );
}

export const Empty: Story = {
  name: "Empty — No Decomposition Yet",
  render: () => <EmptyPreview />,
};

export const Processing: Story = {
  name: "Processing — AI Generating",
  render: () => <ProcessingPreview />,
};

export const ErrorState: Story = {
  name: "Error — Generation Failed",
  render: () => <ErrorPreview />,
};

export const WithTasks: Story = {
  name: "Complete — With Tasks",
  render: () => <DecompositionPreview />,
};

export const WithoutConsiderations: Story = {
  name: "Complete — No Critical Considerations",
  render: () => <DecompositionPreview showCriticalConsiderations={false} />,
};

export const Rejected: Story = {
  name: "Rejected State",
  render: () => <DecompositionPreview isRejected />,
};

export const Accepted: Story = {
  name: "Accepted State",
  render: () => <AcceptedPreview />,
};

export const SelectTask: Story = {
  name: "Interaction — Select a Task",
  render: () => <DecompositionPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkboxes = canvas.getAllByRole("button").filter((btn: HTMLElement) => {
      const style = btn.className;
      return style.includes("h-4") && style.includes("w-4");
    });
    if (checkboxes[0]) {
      await userEvent.click(checkboxes[0]);
    }
  },
};

export const AcceptAllTasks: Story = {
  name: "Interaction — Accept All Tasks",
  render: () => <DecompositionPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const acceptButton = canvas.getByRole("button", { name: /accept all tasks/i });
    await userEvent.click(acceptButton);
  },
};

export const RejectDecomposition: Story = {
  name: "Interaction — Reject Decomposition",
  render: () => <DecompositionPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rejectButton = canvas.getByRole("button", { name: /^reject$/i });
    await userEvent.click(rejectButton);
  },
};

export const Mobile: Story = {
  name: "Mobile — With Tasks",
  render: () => <DecompositionPreview />,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet — With Tasks",
  render: () => <DecompositionPreview />,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
