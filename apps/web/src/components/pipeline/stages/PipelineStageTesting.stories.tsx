import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineStageTesting } from "./PipelineStageTesting";

const meta = {
  title: "Pipeline/Stages/PipelineStageTesting",
  component: PipelineStageTesting,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageTesting>;

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

export const AllInReview: Story = {
  args: {
    ...commonProps,
    tasks: [
      { _id: "task_001", title: "Build account settings page", status: "review" },
      { _id: "task_002", title: "Implement order history API endpoint", status: "review" },
      { _id: "task_003", title: "Payment method management UI", status: "review" },
    ],
  },
};

export const MixedReviewAndDone: Story = {
  args: {
    ...commonProps,
    tasks: [
      { _id: "task_001", title: "Build account settings page", status: "done" },
      { _id: "task_002", title: "Implement order history API endpoint", status: "done" },
      { _id: "task_003", title: "Payment method management UI", status: "review" },
      { _id: "task_004", title: "Email notification for account changes", status: "review" },
    ],
  },
};

export const AllDone: Story = {
  args: {
    ...commonProps,
    tasks: [
      { _id: "task_001", title: "Build account settings page", status: "done" },
      { _id: "task_002", title: "Implement order history API endpoint", status: "done" },
      { _id: "task_003", title: "Payment method management UI", status: "done" },
    ],
  },
};

export const NoTasks: Story = {
  args: {
    ...commonProps,
    tasks: [],
  },
};

export const SingleTaskInReview: Story = {
  args: {
    ...commonProps,
    tasks: [{ _id: "task_001", title: "Build account settings page", status: "review" }],
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    tasks: [
      { _id: "task_001", title: "Build account settings page", status: "review" },
      { _id: "task_002", title: "Implement order history API endpoint", status: "done" },
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
      { _id: "task_001", title: "Build account settings page", status: "review" },
      { _id: "task_002", title: "Implement order history API endpoint", status: "review" },
      { _id: "task_003", title: "Payment method management UI", status: "done" },
    ],
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
