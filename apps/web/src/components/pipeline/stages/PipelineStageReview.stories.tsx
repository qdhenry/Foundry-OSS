import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { PipelineStageReview } from "./PipelineStageReview";

const meta = {
  title: "Pipeline/Stages/PipelineStageReview",
  component: PipelineStageReview,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageReview>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseRequirement = {
  _id: "req_001",
  refId: "BM-001",
  title: "Customer Account Management — self-service portal for B2B buyers",
  description:
    "Buyers need to manage their own account details, order history, and payment methods.",
  priority: "must_have",
  fitGap: "custom_dev",
  effortEstimate: "high",
  status: "approved",
};

const doneTasks = [
  { _id: "task_001", title: "Build account settings page", status: "done" },
  { _id: "task_002", title: "Implement order history API endpoint", status: "done" },
  { _id: "task_003", title: "Payment method management UI", status: "done" },
  { _id: "task_004", title: "Email notification for account changes", status: "done" },
  { _id: "task_005", title: "Unit tests for account API", status: "done" },
];

const commonProps = {
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
};

export const AllTasksDoneReadyToApprove: Story = {
  args: {
    ...commonProps,
    requirement: baseRequirement,
    tasks: doneTasks,
  },
};

export const AlreadyComplete: Story = {
  args: {
    ...commonProps,
    requirement: { ...baseRequirement, status: "complete" },
    tasks: doneTasks,
  },
};

export const SomeTasksStillIncomplete: Story = {
  args: {
    ...commonProps,
    requirement: baseRequirement,
    tasks: [
      { _id: "task_001", title: "Build account settings page", status: "done" },
      { _id: "task_002", title: "Implement order history API endpoint", status: "done" },
      { _id: "task_003", title: "Payment method management UI", status: "review" },
      { _id: "task_004", title: "Email notification for account changes", status: "in_progress" },
    ],
  },
};

export const NoTasks: Story = {
  args: {
    ...commonProps,
    requirement: baseRequirement,
    tasks: [],
  },
};

export const SingleTaskDone: Story = {
  args: {
    ...commonProps,
    requirement: baseRequirement,
    tasks: [{ _id: "task_001", title: "Build account settings page", status: "done" }],
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    requirement: baseRequirement,
    tasks: doneTasks,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...commonProps,
    requirement: baseRequirement,
    tasks: doneTasks,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const ClickMarkComplete: Story = {
  args: {
    ...commonProps,
    requirement: baseRequirement,
    tasks: doneTasks,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const approveButton = canvas.getByRole("button", {
      name: /approve.*mark complete/i,
    });
    await userEvent.click(approveButton);
  },
};
