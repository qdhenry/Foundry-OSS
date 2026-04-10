import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineSummaryBar } from "./PipelineSummaryBar";
import { MOCK_REQUIREMENTS, PIPELINE_STAGES } from "./pipeline-mock-data";
import type { MockRequirement } from "./pipeline-types";

const meta: Meta<typeof PipelineSummaryBar> = {
  title: "PipelineLab/PipelineSummaryBar",
  component: PipelineSummaryBar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ position: "relative", minHeight: "120px" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PipelineSummaryBar>;

export const Default: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    stages: PIPELINE_STAGES,
  },
};

export const NoBlockedItems: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS.map((r) => ({
      ...r,
      health: "on_track" as const,
    })),
    stages: PIPELINE_STAGES,
  },
};

export const MultipleBlockedItems: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS.map((r, i) => ({
      ...r,
      health: i % 3 === 0 ? ("blocked" as const) : r.health,
    })),
    stages: PIPELINE_STAGES,
  },
};

export const AllDeployed: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS.map((r) => ({
      ...r,
      currentStage: "deployed" as const,
      health: "on_track" as const,
    })),
    stages: PIPELINE_STAGES,
  },
};

export const NoneDeployed: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS.map((r) => ({
      ...r,
      currentStage: "discovery" as const,
    })),
    stages: PIPELINE_STAGES,
  },
};

export const HeavilyBackloaded: Story = {
  name: "Heavily Backloaded (mostly discovery)",
  args: {
    requirements: [
      ...Array.from({ length: 10 }, (_, i) => ({
        ...MOCK_REQUIREMENTS[0],
        id: `backlog-${i}`,
        refId: `BLK-00${i}`,
        currentStage: "discovery" as const,
        health: "on_track" as const,
      })),
      ...MOCK_REQUIREMENTS.slice(0, 3),
    ] as MockRequirement[],
    stages: PIPELINE_STAGES,
  },
};

export const EmptyRequirements: Story = {
  args: {
    requirements: [],
    stages: PIPELINE_STAGES,
  },
};

export const SingleRequirement: Story = {
  args: {
    requirements: [MOCK_REQUIREMENTS[0]],
    stages: PIPELINE_STAGES,
  },
};

export const Mobile: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    stages: PIPELINE_STAGES,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    stages: PIPELINE_STAGES,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
