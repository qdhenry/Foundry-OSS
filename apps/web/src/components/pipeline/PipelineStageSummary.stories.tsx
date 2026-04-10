import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { PipelineStageSummary } from "./PipelineStageSummary";

const meta = {
  title: "Pipeline/PipelineStageSummary",
  component: PipelineStageSummary,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

const fullCounts = {
  discovery: 3,
  requirement: 12,
  sprint_planning: 8,
  task_generation: 15,
  subtask_generation: 6,
  implementation: 22,
  testing: 9,
  review: 5,
};

const baseArgs = {
  counts: fullCounts,
  activeStage: null,
  onStageClick: fn(),
  total: Object.values(fullCounts).reduce((a, b) => a + b, 0),
};

export const Default: Story = {
  args: baseArgs,
};

export const WithActiveStage: Story = {
  args: {
    ...baseArgs,
    activeStage: "implementation" as const,
  },
};

export const ActiveDiscovery: Story = {
  args: {
    ...baseArgs,
    activeStage: "discovery" as const,
  },
};

export const ActiveReview: Story = {
  args: {
    ...baseArgs,
    activeStage: "review" as const,
  },
};

export const SparseCounts: Story = {
  args: {
    counts: {
      discovery: 0,
      requirement: 4,
      sprint_planning: 0,
      task_generation: 7,
      subtask_generation: 0,
      implementation: 3,
      testing: 0,
      review: 0,
    },
    activeStage: null,
    onStageClick: fn(),
    total: 14,
  },
};

export const SingleRequirement: Story = {
  args: {
    counts: {
      discovery: 0,
      requirement: 1,
      sprint_planning: 0,
      task_generation: 0,
      subtask_generation: 0,
      implementation: 0,
      testing: 0,
      review: 0,
    },
    activeStage: null,
    onStageClick: fn(),
    total: 1,
  },
};

export const AllInReview: Story = {
  args: {
    counts: {
      discovery: 0,
      requirement: 0,
      sprint_planning: 0,
      task_generation: 0,
      subtask_generation: 0,
      implementation: 0,
      testing: 0,
      review: 18,
    },
    activeStage: "review" as const,
    onStageClick: fn(),
    total: 18,
  },
};

export const Mobile: Story = {
  args: baseArgs,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: baseArgs,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const ClickStage: Story = {
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const implButton = canvas.getByRole("button", { name: /impl/i });
    await userEvent.click(implButton);
  },
};

export const ClearActiveFilter: Story = {
  args: {
    ...baseArgs,
    activeStage: "testing" as const,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.getByRole("button", { name: /clear/i });
    await userEvent.click(clearButton);
  },
};
