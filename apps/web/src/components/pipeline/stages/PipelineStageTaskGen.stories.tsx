import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineStageTaskGen } from "./PipelineStageTaskGen";

const meta = {
  title: "Pipeline/Stages/PipelineStageTaskGen",
  component: PipelineStageTaskGen,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageTaskGen>;

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

export const NoTasks: Story = {
  args: {
    ...commonProps,
    tasks: [],
  },
};

export const WithActiveTasks: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "backlog",
        priority: "high",
        assigneeName: "Alice Chen",
      },
      {
        _id: "task_002",
        title: "Implement order history API endpoint",
        status: "todo",
        priority: "high",
        assigneeName: "Bob Kim",
      },
      {
        _id: "task_003",
        title: "Payment method management UI",
        status: "backlog",
        priority: "medium",
      },
      {
        _id: "task_004",
        title: "Email notification for account changes",
        status: "backlog",
        priority: "low",
      },
    ],
  },
};

export const MixedTaskStatuses: Story = {
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
        title: "Implement order history API endpoint",
        status: "done",
        priority: "high",
      },
      {
        _id: "task_003",
        title: "Payment method management UI",
        status: "todo",
        priority: "medium",
        assigneeName: "Carol Torres",
      },
    ],
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    tasks: [],
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...commonProps,
    tasks: [],
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
