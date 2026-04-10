import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { StageNextSteps } from "./StageNextSteps";

const meta = {
  title: "Pipeline/Stages/StageNextSteps",
  component: StageNextSteps,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof StageNextSteps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    steps: [],
  },
};

export const SingleStep: Story = {
  args: {
    steps: [
      {
        label: "Approve the requirement",
        description: "Change status to Approved so it can be assigned to a sprint.",
      },
    ],
  },
};

export const WithLinkStep: Story = {
  args: {
    steps: [
      {
        label: "Review the finding in Discovery Hub",
        description:
          "Verify the AI-extracted data is accurate and approve or edit before advancing.",
        href: "/prog_123/discovery?tab=findings",
      },
    ],
  },
};

export const WithClickableStep: Story = {
  args: {
    steps: [
      {
        label: "Generate Tasks with AI",
        description:
          "Break this requirement into implementation tasks using AI task decomposition.",
        onClick: fn(),
      },
    ],
  },
};

export const MultipleSteps: Story = {
  args: {
    steps: [
      {
        label: "Set effort estimate",
        description: "An effort estimate helps with sprint planning and workload balancing.",
        onClick: fn(),
      },
      {
        label: "Approve the requirement",
        description: "Change status to Approved so it can be assigned to a sprint.",
        onClick: fn(),
      },
      {
        label: "Assign to a sprint to advance to planning",
        description: "Select a sprint below to move this requirement into Sprint Planning.",
      },
    ],
  },
};

export const MixedStepTypes: Story = {
  args: {
    steps: [
      {
        label: "Review the finding in Discovery Hub",
        description: "Verify the AI-extracted data is accurate.",
        href: "/prog_123/discovery?tab=findings",
      },
      {
        label: "Generate Tasks with AI",
        description: "Break this requirement into implementation tasks.",
        onClick: fn(),
      },
      {
        label: "Assign to a sprint",
        description: "Select a sprint to begin work.",
      },
    ],
  },
};

export const Mobile: Story = {
  args: {
    steps: [
      {
        label: "Set effort estimate",
        description: "An effort estimate helps with sprint planning and workload balancing.",
        onClick: fn(),
      },
      {
        label: "Approve the requirement",
        description: "Change status to Approved so it can be assigned to a sprint.",
      },
    ],
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    steps: [
      {
        label: "Set effort estimate",
        description: "An effort estimate helps with sprint planning and workload balancing.",
        onClick: fn(),
      },
      {
        label: "Approve the requirement",
        description: "Change status to Approved so it can be assigned to a sprint.",
      },
    ],
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const ClickActionStep: Story = {
  args: {
    steps: [
      {
        label: "Generate Tasks with AI",
        description: "Break this requirement into implementation tasks.",
        onClick: fn(),
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const actionButton = canvas.getByRole("button", {
      name: /generate tasks with ai/i,
    });
    await userEvent.click(actionButton);
  },
};
