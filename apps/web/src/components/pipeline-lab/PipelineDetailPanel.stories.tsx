import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { PipelineDetailPanel } from "./PipelineDetailPanel";
import { MOCK_REQUIREMENTS, PIPELINE_STAGES } from "./pipeline-mock-data";
import type { MockRequirement } from "./pipeline-types";

// A requirement currently in sprint_planning with AI recommendation
const sprintPlanningReq: MockRequirement = MOCK_REQUIREMENTS.find((r) => r.id === "req-cat-003")!;

// A requirement that is blocked in implementation
const blockedReq: MockRequirement = MOCK_REQUIREMENTS.find((r) => r.id === "req-cat-005")!;

// A fully deployed requirement with complete history
const deployedReq: MockRequirement = MOCK_REQUIREMENTS.find((r) => r.id === "req-cat-006")!;

// A requirement with no AI recommendation
const noAIReq: MockRequirement = MOCK_REQUIREMENTS.find((r) => r.id === "req-cat-001")!;

// A must-have blocked requirement
const mustHaveBlockedReq: MockRequirement = {
  ...blockedReq,
  priority: "must_have",
  health: "blocked",
  daysInStage: 12,
};

const meta: Meta<typeof PipelineDetailPanel> = {
  title: "PipelineLab/PipelineDetailPanel",
  component: PipelineDetailPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: "100vh", position: "relative" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PipelineDetailPanel>;

export const Default: Story = {
  args: {
    requirement: sprintPlanningReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const BlockedRequirement: Story = {
  args: {
    requirement: blockedReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const MustHaveBlocked: Story = {
  args: {
    requirement: mustHaveBlockedReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const FullyDeployed: Story = {
  args: {
    requirement: deployedReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const NoAIRecommendation: Story = {
  args: {
    requirement: noAIReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const LongStageHistory: Story = {
  args: {
    requirement: MOCK_REQUIREMENTS.find((r) => r.id === "req-ord-005")!,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const EarlyStage: Story = {
  name: "Early Stage (Discovery)",
  args: {
    requirement: MOCK_REQUIREMENTS.find((r) => r.id === "req-cat-001")!,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const AtRiskInGapAnalysis: Story = {
  name: "At Risk — Gap Analysis",
  args: {
    requirement: MOCK_REQUIREMENTS.find((r) => r.id === "req-chk-001")!,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const DaysInStageWarning: Story = {
  name: "Long Time in Stage (> 5 days)",
  args: {
    requirement: {
      ...sprintPlanningReq,
      daysInStage: 9,
    },
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
};

export const CloseButtonInteraction: Story = {
  args: {
    requirement: sprintPlanningReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The close button is an SVG button in the panel header
    const closeButton = canvas.getAllByRole("button")[0];
    await userEvent.click(closeButton);
  },
};

export const Mobile: Story = {
  args: {
    requirement: sprintPlanningReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    requirement: blockedReq,
    stages: PIPELINE_STAGES,
    onClose: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
