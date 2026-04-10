import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineStageImplementation } from "./PipelineStageImplementation";

const meta = {
  title: "Pipeline/Stages/PipelineStageImplementation",
  component: PipelineStageImplementation,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageImplementation>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseRequirement = {
  _id: "req_001",
  refId: "BM-001",
  title: "Customer Account Management — self-service portal for B2B buyers",
};

const commonProps = {
  requirement: baseRequirement,
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
};

const allTasks = [
  {
    _id: "task_001",
    title: "Build account settings page",
    status: "in_progress",
    priority: "high",
    assigneeName: "Alice Chen",
  },
  {
    _id: "task_002",
    title: "Implement order history API endpoint",
    status: "in_progress",
    priority: "high",
    assigneeName: "Bob Kim",
  },
  {
    _id: "task_003",
    title: "Payment method management UI",
    status: "todo",
    priority: "medium",
    assigneeName: "Carol Torres",
  },
  {
    _id: "task_004",
    title: "Email notification for account changes",
    status: "done",
    priority: "low",
  },
  {
    _id: "task_005",
    title: "Unit tests for account API",
    status: "done",
    priority: "medium",
    assigneeName: "Dave Park",
  },
  {
    _id: "task_006",
    title: "Integration tests",
    status: "review",
    priority: "medium",
    assigneeName: "Alice Chen",
  },
];

export const ActiveImplementation: Story = {
  args: {
    ...commonProps,
    tasks: allTasks,
  },
};

export const EarlyImplementation: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "in_progress",
        priority: "high",
        assigneeName: "Alice Chen",
      },
      {
        _id: "task_002",
        title: "Implement order history API",
        status: "backlog",
        priority: "high",
      },
      {
        _id: "task_003",
        title: "Payment method management UI",
        status: "backlog",
        priority: "medium",
      },
    ],
  },
};

export const NearlyComplete: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "done",
        priority: "high",
        assigneeName: "Alice Chen",
      },
      {
        _id: "task_002",
        title: "Implement order history API",
        status: "done",
        priority: "high",
        assigneeName: "Bob Kim",
      },
      {
        _id: "task_003",
        title: "Payment method management UI",
        status: "review",
        priority: "medium",
        assigneeName: "Carol Torres",
      },
    ],
  },
};

export const AllInProgress: Story = {
  args: {
    ...commonProps,
    tasks: allTasks.map((t) => ({ ...t, status: "in_progress" })),
  },
};

export const AllDone: Story = {
  args: {
    ...commonProps,
    tasks: allTasks.map((t) => ({ ...t, status: "done" })),
  },
};

export const NoTasks: Story = {
  args: {
    ...commonProps,
    tasks: [],
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    tasks: allTasks,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...commonProps,
    tasks: allTasks,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
