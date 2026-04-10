import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineActivityLog } from "./PipelineActivityLog";

const meta = {
  title: "Pipeline/PipelineActivityLog",
  component: PipelineActivityLog,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineActivityLog>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockArgs = {
  programId: "prog_123" as any,
  requirementId: "req_456" as any,
  currentStage: "implementation" as const,
};

export const Default: Story = {
  args: mockArgs,
};

export const DiscoveryStage: Story = {
  args: {
    ...mockArgs,
    currentStage: "discovery",
  },
};

export const RequirementStage: Story = {
  args: {
    ...mockArgs,
    currentStage: "requirement",
  },
};

export const SprintPlanningStage: Story = {
  args: {
    ...mockArgs,
    currentStage: "sprint_planning",
  },
};

export const ReviewStage: Story = {
  args: {
    ...mockArgs,
    currentStage: "review",
  },
};

export const Mobile: Story = {
  args: mockArgs,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: mockArgs,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
