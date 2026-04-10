import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { PipelineStageSprint } from "./PipelineStageSprint";

const meta = {
  title: "Pipeline/Stages/PipelineStageSprint",
  component: PipelineStageSprint,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageSprint>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseRequirement = {
  _id: "req_001",
  orgId: "org_acme",
  refId: "BM-001",
  title: "Customer Account Management — self-service portal for B2B buyers",
  priority: "must_have",
  effortEstimate: "high",
  status: "approved",
};

const commonProps = {
  requirement: baseRequirement,
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
};

export const NoSprintNoTasks: Story = {
  args: {
    ...commonProps,
    tasks: [],
  },
};

export const WithEstimateNoSprint: Story = {
  args: {
    ...commonProps,
    tasks: [],
    requirement: { ...baseRequirement, effortEstimate: "medium" },
  },
};

export const NoEffortEstimate: Story = {
  args: {
    ...commonProps,
    tasks: [],
    requirement: { ...baseRequirement, effortEstimate: undefined },
  },
};

export const AssignedToSprint: Story = {
  args: {
    ...commonProps,
    tasks: [
      {
        _id: "t1",
        title: "Build account settings page",
        status: "backlog",
        sprintName: "Sprint 3 - Core Accounts",
      },
      {
        _id: "t2",
        title: "Implement order history API",
        status: "todo",
        sprintName: "Sprint 3 - Core Accounts",
      },
    ],
  },
};

export const WithTasksButNoSprint: Story = {
  args: {
    ...commonProps,
    tasks: [
      { _id: "t1", title: "Build account settings page", status: "backlog", sprintName: undefined },
      { _id: "t2", title: "Implement order history API", status: "todo", sprintName: undefined },
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

export const ClickNewSprint: Story = {
  args: {
    ...commonProps,
    tasks: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const newSprintButton = canvas.getByRole("button", { name: /new sprint/i });
    await userEvent.click(newSprintButton);
  },
};
