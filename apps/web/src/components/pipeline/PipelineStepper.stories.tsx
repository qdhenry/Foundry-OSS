import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { PipelineStepper } from "./PipelineStepper";

const meta = {
  title: "Pipeline/PipelineStepper",
  component: PipelineStepper,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Discovery: Story = {
  args: {
    currentStage: "discovery",
    onStageClick: fn(),
  },
};

export const Requirement: Story = {
  args: {
    currentStage: "requirement",
    onStageClick: fn(),
  },
};

export const SprintPlanning: Story = {
  args: {
    currentStage: "sprint_planning",
    onStageClick: fn(),
  },
};

export const TaskGeneration: Story = {
  args: {
    currentStage: "task_generation",
    onStageClick: fn(),
  },
};

export const SubtaskGeneration: Story = {
  args: {
    currentStage: "subtask_generation",
    onStageClick: fn(),
  },
};

export const Implementation: Story = {
  args: {
    currentStage: "implementation",
    onStageClick: fn(),
  },
};

export const Testing: Story = {
  args: {
    currentStage: "testing",
    onStageClick: fn(),
  },
};

export const Review: Story = {
  args: {
    currentStage: "review",
    onStageClick: fn(),
  },
};

export const NoClickHandler: Story = {
  args: {
    currentStage: "implementation",
  },
};

export const Mobile: Story = {
  args: {
    currentStage: "implementation",
    onStageClick: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const MobileEarlyStage: Story = {
  args: {
    currentStage: "discovery",
    onStageClick: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    currentStage: "implementation",
    onStageClick: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const ClickStage: Story = {
  args: {
    currentStage: "implementation",
    onStageClick: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the first visible stage button on desktop
    const buttons = canvas.getAllByRole("button");
    if (buttons.length > 0) {
      await userEvent.click(buttons[0]);
    }
  },
};
