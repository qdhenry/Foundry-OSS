import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { MockRequirement } from "./pipeline-types";
import { RequirementTooltip } from "./RequirementTooltip";

const baseRequirement: MockRequirement = {
  id: "req-chk-001",
  refId: "CHK-001",
  title: "Multi-step checkout with saved payment methods",
  workstreamId: "ws-checkout",
  currentStage: "gap_analysis",
  health: "at_risk",
  priority: "must_have",
  fitGap: "custom_dev",
  effort: "high",
  daysInStage: 5,
  stageHistory: [
    { stage: "discovery", enteredAt: "2026-02-05", exitedAt: "2026-02-10" },
    { stage: "gap_analysis", enteredAt: "2026-02-10" },
  ],
  aiRecommendation:
    "Consider Stripe Elements integration for saved payment method support instead of custom development.",
};

const meta: Meta<typeof RequirementTooltip> = {
  title: "PipelineLab/RequirementTooltip",
  component: RequirementTooltip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ padding: "6rem 2rem 2rem" }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof RequirementTooltip>;

export const Default: Story = {
  args: {
    requirement: baseRequirement,
    visible: true,
  },
};

export const Hidden: Story = {
  args: {
    requirement: baseRequirement,
    visible: false,
  },
};

export const WithAIRecommendation: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      aiRecommendation:
        "High effort item stuck in planning. Consider breaking into 3 sub-tasks: CDN setup, batch script, URL redirect rules.",
    },
    visible: true,
  },
};

export const NoAIRecommendation: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      aiRecommendation: undefined,
    },
    visible: true,
  },
};

export const MustHavePriority: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      priority: "must_have",
      fitGap: "native",
      effort: "low",
      health: "on_track",
    },
    visible: true,
  },
};

export const NiceToHavePriority: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      refId: "CHK-005",
      title: "Guest checkout flow with address validation",
      priority: "nice_to_have",
      fitGap: "native",
      effort: "low",
      health: "on_track",
      daysInStage: 3,
      currentStage: "testing",
      aiRecommendation: undefined,
    },
    visible: true,
  },
};

export const BlockedHealth: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      refId: "CAT-005",
      title: "Product search with faceted filtering",
      health: "blocked",
      fitGap: "custom_dev",
      effort: "high",
      daysInStage: 8,
      currentStage: "implementation",
      aiRecommendation:
        "Blocked on search index provisioning. Escalate to platform team for Algolia credentials.",
    },
    visible: true,
  },
};

export const VeryHighEffort: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      refId: "CAT-003",
      title: "Product image batch migration with CDN routing",
      priority: "must_have",
      fitGap: "custom_dev",
      effort: "very_high",
      health: "at_risk",
      daysInStage: 6,
      currentStage: "sprint_planning",
    },
    visible: true,
  },
};

export const DeployedStage: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      refId: "CAT-006",
      title: "Basic product listing page with pagination",
      priority: "must_have",
      fitGap: "native",
      effort: "low",
      health: "on_track",
      daysInStage: 5,
      currentStage: "deployed",
      aiRecommendation: undefined,
    },
    visible: true,
  },
};

export const Mobile: Story = {
  args: {
    requirement: baseRequirement,
    visible: true,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    requirement: baseRequirement,
    visible: true,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
