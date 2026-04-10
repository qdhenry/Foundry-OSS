import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { PipelineStageRequirement } from "./PipelineStageRequirement";

const meta = {
  title: "Pipeline/Stages/PipelineStageRequirement",
  component: PipelineStageRequirement,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageRequirement>;

export default meta;
type Story = StoryObj<typeof meta>;

const draftRequirement = {
  _id: "req_001",
  orgId: "org_acme",
  refId: "BM-001",
  title: "Customer Account Management — self-service portal for B2B buyers",
  description:
    "Buyers need to manage their own account details, order history, and payment methods without contacting support.",
  priority: "must_have",
  fitGap: "custom_dev",
  effortEstimate: undefined as string | undefined,
  status: "draft",
};

const approvedRequirement = {
  ...draftRequirement,
  status: "approved",
  effortEstimate: "high",
};

const commonProps = {
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
  tasks: [],
};

export const DraftNoEffort: Story = {
  args: {
    ...commonProps,
    requirement: draftRequirement,
  },
};

export const DraftWithEffort: Story = {
  args: {
    ...commonProps,
    requirement: { ...draftRequirement, effortEstimate: "medium" },
  },
};

export const ApprovedNoTasks: Story = {
  args: {
    ...commonProps,
    requirement: approvedRequirement,
  },
};

export const ApprovedWithTasks: Story = {
  args: {
    ...commonProps,
    requirement: approvedRequirement,
    tasks: [
      {
        _id: "t1",
        title: "Build account settings page",
        status: "backlog",
        sprintName: "Sprint 3",
      },
      { _id: "t2", title: "Implement order history API", status: "todo", sprintName: "Sprint 3" },
    ],
  },
};

export const AssignedToSprint: Story = {
  args: {
    ...commonProps,
    requirement: approvedRequirement,
    tasks: [
      {
        _id: "t1",
        title: "Build account settings page",
        status: "backlog",
        sprintName: "Sprint 3 - Core Accounts",
      },
    ],
  },
};

export const InProgress: Story = {
  args: {
    ...commonProps,
    requirement: { ...approvedRequirement, status: "in_progress" },
    tasks: [
      {
        _id: "t1",
        title: "Build account settings page",
        status: "in_progress",
        sprintName: "Sprint 3",
      },
    ],
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    requirement: draftRequirement,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...commonProps,
    requirement: approvedRequirement,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const ClickEdit: Story = {
  args: {
    ...commonProps,
    requirement: approvedRequirement,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const editButton = canvas.getByRole("button", { name: /edit/i });
    await userEvent.click(editButton);
  },
};
