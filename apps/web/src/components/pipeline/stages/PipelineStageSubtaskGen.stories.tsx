import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineStageSubtaskGen } from "./PipelineStageSubtaskGen";

const meta = {
  title: "Pipeline/Stages/PipelineStageSubtaskGen",
  component: PipelineStageSubtaskGen,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageSubtaskGen>;

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

export const AllTasksAwaitingSubtasks: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "backlog",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
      {
        _id: "task_002",
        title: "Implement order history API endpoint",
        status: "todo",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
      {
        _id: "task_003",
        title: "Payment method management UI",
        status: "backlog",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
    ],
  },
};

export const SomeTasksWithSubtasks: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "backlog",
        hasSubtasks: true,
        subtaskCount: 5,
        subtasksCompleted: 2,
      },
      {
        _id: "task_002",
        title: "Implement order history API endpoint",
        status: "todo",
        hasSubtasks: true,
        subtaskCount: 3,
        subtasksCompleted: 3,
      },
      {
        _id: "task_003",
        title: "Payment method management UI",
        status: "backlog",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
    ],
  },
};

export const AllTasksHaveSubtasks: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "backlog",
        hasSubtasks: true,
        subtaskCount: 5,
        subtasksCompleted: 5,
      },
      {
        _id: "task_002",
        title: "Implement order history API endpoint",
        status: "todo",
        hasSubtasks: true,
        subtaskCount: 4,
        subtasksCompleted: 1,
      },
    ],
  },
};

export const SingleTaskPartialSubtasks: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "in_progress",
        hasSubtasks: true,
        subtaskCount: 8,
        subtasksCompleted: 3,
      },
    ],
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "backlog",
        hasSubtasks: true,
        subtaskCount: 5,
        subtasksCompleted: 2,
      },
      {
        _id: "task_002",
        title: "Implement order history API",
        status: "todo",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
    ],
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "task_001",
        title: "Build account settings page",
        status: "backlog",
        hasSubtasks: true,
        subtaskCount: 5,
        subtasksCompleted: 2,
      },
    ],
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
