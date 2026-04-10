import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { TaskAuditTrail } from "./TaskAuditTrail";

/**
 * TaskAuditTrail uses useQuery(api.executionAudit.listByTask).
 * The Convex mock resolves this to key "executionAudit:listByTask".
 * We inject mock records via setMockOverrides in decorators.
 *
 * The component also renders SandboxLogSummary for sandbox_started events,
 * which calls useQuery(api.sandbox.logs.summaryByTask) — keyed "logs:summaryByTask".
 * We seed both in decorators where relevant.
 *
 * When records === undefined the component renders a loading state.
 * When records.length === 0 it renders an empty state.
 */

// ── Mock helpers ──────────────────────────────────────────────────────────────

type MockStore = { setMockOverrides: (o: Record<string, unknown>) => void };
const convexMock = (): MockStore =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../../.storybook/mocks/convex") as MockStore;

const NOW = Date.now();
const minutesAgo = (m: number) => NOW - m * 60 * 1000;
const hoursAgo = (h: number) => NOW - h * 60 * 60 * 1000;
const daysAgo = (d: number) => NOW - d * 24 * 60 * 60 * 1000;

// ── Mock audit records ────────────────────────────────────────────────────────

const sandboxStartedRecord = {
  _id: "rec-001",
  taskId: "task-1",
  eventType: "sandbox_started",
  initiatedByName: "Sarah Chen",
  timestamp: minutesAgo(30),
  environment: { worktreeBranch: "feature/sku-mapper-001" },
  outcome: null,
  metadata: null,
  skillName: "Product Data Transform",
};

const sandboxCompletedRecord = {
  _id: "rec-002",
  taskId: "task-1",
  eventType: "sandbox_completed",
  initiatedByName: "Sarah Chen",
  timestamp: minutesAgo(10),
  environment: { worktreeBranch: "feature/sku-mapper-001" },
  outcome: {
    filesChanged: 3,
    tokensUsed: 12480,
    durationMs: 48200,
    prNumber: 42,
  },
  metadata: null,
  skillName: "Product Data Transform",
};

const sandboxFailedRecord = {
  _id: "rec-fail-001",
  taskId: "task-1",
  eventType: "sandbox_failed",
  initiatedByName: "Alex Kim",
  timestamp: hoursAgo(2),
  environment: { worktreeBranch: "feature/order-etl-002" },
  outcome: {
    error: "TypeError: Cannot read properties of undefined (reading 'sku')",
    filesChanged: 1,
    tokensUsed: 3200,
    durationMs: 8700,
  },
  metadata: null,
  skillName: "Order History ETL",
};

const sandboxCancelledRecord = {
  _id: "rec-cancel-001",
  taskId: "task-1",
  eventType: "sandbox_cancelled",
  initiatedByName: "Jordan Park",
  timestamp: hoursAgo(4),
  environment: { worktreeBranch: "feature/category-map-003" },
  outcome: null,
  metadata: null,
  skillName: null,
};

const reviewAcceptedRecord = {
  _id: "rec-review-001",
  taskId: "task-1",
  eventType: "review_accepted",
  initiatedByName: "Taylor Wong",
  timestamp: minutesAgo(5),
  environment: null,
  outcome: null,
  metadata: null,
  skillName: null,
};

const reviewRejectedRecord = {
  _id: "rec-review-002",
  taskId: "task-1",
  eventType: "review_rejected",
  initiatedByName: "Taylor Wong",
  timestamp: hoursAgo(1),
  environment: null,
  outcome: null,
  metadata: null,
  skillName: null,
};

const reviewRevisedRecord = {
  _id: "rec-review-003",
  taskId: "task-1",
  eventType: "review_revised",
  initiatedByName: "Sarah Chen",
  timestamp: hoursAgo(3),
  environment: null,
  outcome: null,
  metadata: null,
  skillName: null,
};

const subtaskStartedRecord = {
  _id: "rec-sub-001",
  taskId: "task-1",
  eventType: "subtask_started",
  initiatedByName: "Alex Kim",
  timestamp: minutesAgo(45),
  environment: null,
  outcome: null,
  metadata: { subtaskTitle: "Generate SKU transformation rules" },
  skillName: "Product Data Transform",
};

const subtaskCompletedRecord = {
  _id: "rec-sub-002",
  taskId: "task-1",
  eventType: "subtask_completed",
  initiatedByName: "Alex Kim",
  timestamp: minutesAgo(20),
  environment: null,
  outcome: {
    filesChanged: 1,
    tokensUsed: 4100,
    durationMs: 15300,
  },
  metadata: { subtaskTitle: "Generate SKU transformation rules" },
  skillName: "Product Data Transform",
};

const subtaskFailedRecord = {
  _id: "rec-sub-003",
  taskId: "task-1",
  eventType: "subtask_failed",
  initiatedByName: "Jordan Park",
  timestamp: hoursAgo(5),
  environment: null,
  outcome: {
    error: "Timeout: subtask exceeded 5 minute execution limit",
    filesChanged: 0,
    tokensUsed: 800,
    durationMs: 300000,
  },
  metadata: { subtaskTitle: "Validate Magento category hierarchy" },
  skillName: "Category Mapper",
};

const subtaskRetriedRecord = {
  _id: "rec-sub-004",
  taskId: "task-1",
  eventType: "subtask_retried",
  initiatedByName: "Jordan Park",
  timestamp: hoursAgo(4.5),
  environment: null,
  outcome: null,
  metadata: { subtaskTitle: "Validate Magento category hierarchy" },
  skillName: "Category Mapper",
};

const withTailTelemetryRecord = {
  _id: "rec-tail-001",
  taskId: "task-1",
  eventType: "sandbox_completed",
  initiatedByName: "Sarah Chen",
  timestamp: minutesAgo(8),
  environment: { worktreeBranch: "feature/sku-mapper-001" },
  outcome: {
    filesChanged: 5,
    tokensUsed: 18320,
    durationMs: 62100,
    prNumber: 47,
  },
  metadata: {
    tailTelemetry: {
      totalInvocations: 3,
      totalCpuTimeMs: 1240,
      errorCount: 0,
      exceptionCount: 0,
      invocations: [
        {
          route: "/api/sandbox/session",
          method: "POST",
          outcome: "ok",
          eventTimestamp: minutesAgo(8),
          cpuTimeMs: 420,
          logCount: 12,
          exceptionCount: 0,
        },
        {
          route: "/api/sandbox/execute",
          method: "POST",
          outcome: "ok",
          eventTimestamp: minutesAgo(6),
          cpuTimeMs: 640,
          logCount: 87,
          exceptionCount: 0,
        },
        {
          route: "/api/sandbox/status",
          method: "GET",
          outcome: "ok",
          eventTimestamp: minutesAgo(1),
          cpuTimeMs: 180,
          logCount: 3,
          exceptionCount: 0,
        },
      ],
    },
  },
  skillName: "Product Data Transform",
};

const withTailTelemetryErrorRecord = {
  _id: "rec-tail-err-001",
  taskId: "task-1",
  eventType: "sandbox_failed",
  initiatedByName: "Alex Kim",
  timestamp: daysAgo(1),
  environment: { worktreeBranch: "feature/order-etl-004" },
  outcome: {
    error: "Worker exceeded CPU time limit",
    filesChanged: 0,
    tokensUsed: 2100,
    durationMs: 30000,
  },
  metadata: {
    tailTelemetry: {
      totalInvocations: 2,
      totalCpuTimeMs: 30200,
      errorCount: 1,
      exceptionCount: 1,
      invocations: [
        {
          route: "/api/sandbox/execute",
          method: "POST",
          outcome: "exceededCpu",
          eventTimestamp: daysAgo(1),
          cpuTimeMs: 30000,
          logCount: 42,
          exceptionCount: 1,
        },
        {
          route: "/api/sandbox/status",
          method: "GET",
          outcome: "ok",
          eventTimestamp: daysAgo(1) + minutesAgo(1),
          cpuTimeMs: 200,
          logCount: 2,
          exceptionCount: 0,
        },
      ],
    },
  },
  skillName: "Order History ETL",
};

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof TaskAuditTrail> = {
  title: "Audit/TaskAuditTrail",
  component: TaskAuditTrail,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    taskId: {
      description: "The task ID used to fetch execution audit records via useQuery",
      control: "text",
    },
    defaultCollapsed: {
      description: "Whether the audit trail panel starts in the collapsed state",
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TaskAuditTrail>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [sandboxCompletedRecord, sandboxStartedRecord],
        "logs:summaryByTask": {
          totalCount: 12,
          levelCounts: { info: 8, stdout: 3, stderr: 1 },
          recentLogs: [
            {
              _id: "l1",
              level: "info",
              message: "Session started",
              timestamp: minutesAgo(30),
              taskId: "task-1",
            },
            {
              _id: "l2",
              level: "stdout",
              message: "Build complete",
              timestamp: minutesAgo(15),
              taskId: "task-1",
            },
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const Empty: Story = {
  name: "Empty State (no events yet)",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "executionAudit:listByTask": [] });
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  name: "Loading State",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "executionAudit:listByTask": undefined });
      return <Story />;
    },
  ],
};

export const DefaultCollapsed: Story = {
  name: "Default Collapsed",
  args: {
    taskId: "task-1",
    defaultCollapsed: true,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [sandboxCompletedRecord, sandboxStartedRecord],
      });
      return <Story />;
    },
  ],
};

export const SandboxStarted: Story = {
  name: "Event: Sandbox Started",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [sandboxStartedRecord],
        "logs:summaryByTask": {
          totalCount: 5,
          levelCounts: { info: 4, stdout: 1 },
          recentLogs: [
            {
              _id: "l1",
              level: "info",
              message: "Session started",
              timestamp: minutesAgo(30),
              taskId: "task-1",
            },
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const SandboxCompleted: Story = {
  name: "Event: Sandbox Completed (with PR)",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "executionAudit:listByTask": [sandboxCompletedRecord] });
      return <Story />;
    },
  ],
};

export const SandboxFailed: Story = {
  name: "Event: Sandbox Failed",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "executionAudit:listByTask": [sandboxFailedRecord] });
      return <Story />;
    },
  ],
};

export const SandboxCancelled: Story = {
  name: "Event: Sandbox Cancelled",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "executionAudit:listByTask": [sandboxCancelledRecord] });
      return <Story />;
    },
  ],
};

export const ReviewEvents: Story = {
  name: "Review Events (accepted / rejected / revised)",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [
          reviewAcceptedRecord,
          reviewRejectedRecord,
          reviewRevisedRecord,
        ],
      });
      return <Story />;
    },
  ],
};

export const SubtaskEvents: Story = {
  name: "Subtask Events (started / completed / failed / retried)",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [
          subtaskCompletedRecord,
          subtaskStartedRecord,
          subtaskRetriedRecord,
          subtaskFailedRecord,
        ],
      });
      return <Story />;
    },
  ],
};

export const WithTailTelemetry: Story = {
  name: "With Worker Tail Telemetry",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "executionAudit:listByTask": [withTailTelemetryRecord] });
      return <Story />;
    },
  ],
};

export const WithTailTelemetryErrors: Story = {
  name: "With Tail Telemetry Errors",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [withTailTelemetryErrorRecord],
      });
      return <Story />;
    },
  ],
};

export const FullLifecycle: Story = {
  name: "Full Execution Lifecycle",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [
          reviewAcceptedRecord,
          sandboxCompletedRecord,
          subtaskCompletedRecord,
          subtaskStartedRecord,
          sandboxStartedRecord,
        ],
        "logs:summaryByTask": {
          totalCount: 24,
          levelCounts: { info: 14, stdout: 8, stderr: 2 },
          recentLogs: [
            {
              _id: "l1",
              level: "info",
              message: "Session complete",
              timestamp: minutesAgo(10),
              taskId: "task-1",
            },
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const ManyEvents: Story = {
  name: "Many Events (8 records)",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [
          reviewAcceptedRecord,
          withTailTelemetryRecord,
          subtaskCompletedRecord,
          subtaskStartedRecord,
          sandboxStartedRecord,
          reviewRejectedRecord,
          sandboxFailedRecord,
          { ...sandboxStartedRecord, _id: "rec-first-001", timestamp: hoursAgo(6) },
        ],
        "logs:summaryByTask": {
          totalCount: 32,
          levelCounts: { info: 20, stdout: 10, stderr: 2 },
          recentLogs: [],
        },
      });
      return <Story />;
    },
  ],
};

export const InteractiveToggle: Story = {
  name: "Interactive: Expand / Collapse",
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [sandboxCompletedRecord, sandboxStartedRecord],
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggleBtn = canvas.getByRole("button", { name: /audit trail/i });
    await expect(toggleBtn).toBeVisible();
    // Collapse
    await userEvent.click(toggleBtn);
    // Expand again
    await userEvent.click(toggleBtn);
  },
};

export const Mobile: Story = {
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [sandboxCompletedRecord, sandboxStartedRecord],
      });
      return <Story />;
    },
  ],
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const Tablet: Story = {
  args: {
    taskId: "task-1",
    defaultCollapsed: false,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "executionAudit:listByTask": [
          reviewAcceptedRecord,
          withTailTelemetryRecord,
          subtaskCompletedRecord,
          subtaskStartedRecord,
          sandboxStartedRecord,
        ],
        "logs:summaryByTask": {
          totalCount: 18,
          levelCounts: { info: 12, stdout: 5, stderr: 1 },
          recentLogs: [],
        },
      });
      return <Story />;
    },
  ],
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
