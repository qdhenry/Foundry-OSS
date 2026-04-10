import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import type { PipelineStageConfig } from "./pipeline-types";
import { StationHeader } from "./StationHeader";

const discoveryStage: PipelineStageConfig = {
  id: "discovery",
  label: "Discovery",
  shortLabel: "DISC",
  order: 0,
};

const sprintPlanningStage: PipelineStageConfig = {
  id: "sprint_planning",
  label: "Sprint Planning",
  shortLabel: "PLAN",
  order: 3,
};

const deployedStage: PipelineStageConfig = {
  id: "deployed",
  label: "Deployed",
  shortLabel: "LIVE",
  order: 7,
};

const meta: Meta<typeof StationHeader> = {
  title: "PipelineLab/StationHeader",
  component: StationHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    count: { control: { type: "number", min: 0, max: 20 } },
    isHighlighted: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof StationHeader>;

export const Default: Story = {
  args: {
    stage: discoveryStage,
    count: 2,
    isHighlighted: false,
    onClick: () => {},
  },
};

export const Highlighted: Story = {
  args: {
    stage: discoveryStage,
    count: 2,
    isHighlighted: true,
    onClick: () => {},
  },
};

export const EmptyCount: Story = {
  args: {
    stage: deployedStage,
    count: 0,
    isHighlighted: false,
    onClick: () => {},
  },
};

export const BottleneckWarning: Story = {
  name: "Bottleneck (count >= 4)",
  args: {
    stage: sprintPlanningStage,
    count: 4,
    isHighlighted: false,
    onClick: () => {},
  },
};

export const BottleneckHighlighted: Story = {
  name: "Bottleneck + Highlighted",
  args: {
    stage: sprintPlanningStage,
    count: 6,
    isHighlighted: true,
    onClick: () => {},
  },
};

export const DeployedStage: Story = {
  args: {
    stage: deployedStage,
    count: 2,
    isHighlighted: false,
    onClick: () => {},
  },
};

export const ClickInteraction: Story = {
  args: {
    stage: discoveryStage,
    count: 2,
    isHighlighted: false,
    onClick: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
  },
};

export const Mobile: Story = {
  args: {
    stage: sprintPlanningStage,
    count: 4,
    isHighlighted: false,
    onClick: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    stage: sprintPlanningStage,
    count: 4,
    isHighlighted: true,
    onClick: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
