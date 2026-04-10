import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineStepper } from "./PipelineStepper";
import { PIPELINE_STAGES } from "./pipeline-mock-data";

const meta: Meta<typeof PipelineStepper> = {
  title: "PipelineLab/PipelineStepper",
  component: PipelineStepper,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    currentStage: {
      control: "select",
      options: [
        "discovery",
        "gap_analysis",
        "solution_design",
        "sprint_planning",
        "implementation",
        "testing",
        "uat",
        "deployed",
      ],
    },
  },
};

export default meta;
type Story = StoryObj<typeof PipelineStepper>;

export const Default: Story = {
  args: {
    currentStage: "discovery",
    stages: PIPELINE_STAGES,
  },
};

export const MidwayThrough: Story = {
  args: {
    currentStage: "sprint_planning",
    stages: PIPELINE_STAGES,
  },
};

export const InImplementation: Story = {
  args: {
    currentStage: "implementation",
    stages: PIPELINE_STAGES,
  },
};

export const InTesting: Story = {
  args: {
    currentStage: "testing",
    stages: PIPELINE_STAGES,
  },
};

export const InUAT: Story = {
  args: {
    currentStage: "uat",
    stages: PIPELINE_STAGES,
  },
};

export const Deployed: Story = {
  args: {
    currentStage: "deployed",
    stages: PIPELINE_STAGES,
  },
};

export const Mobile: Story = {
  args: {
    currentStage: "implementation",
    stages: PIPELINE_STAGES,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    currentStage: "testing",
    stages: PIPELINE_STAGES,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
