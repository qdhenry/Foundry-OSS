import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import type { MockRequirement } from "./pipeline-types";
import { RequirementDot } from "./RequirementDot";

const baseRequirement: MockRequirement = {
  id: "req-cat-001",
  refId: "CAT-001",
  title: "Product attribute mapping from Magento to B2B Commerce",
  workstreamId: "ws-catalog",
  currentStage: "discovery",
  health: "on_track",
  priority: "must_have",
  fitGap: "config",
  effort: "medium",
  daysInStage: 3,
  stageHistory: [{ stage: "discovery", enteredAt: "2026-02-12" }],
};

const meta: Meta<typeof RequirementDot> = {
  title: "PipelineLab/RequirementDot",
  component: RequirementDot,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    workstreamColor: { control: "color" },
  },
};

export default meta;
type Story = StoryObj<typeof RequirementDot>;

export const Default: Story = {
  args: {
    requirement: baseRequirement,
    workstreamColor: "#3b82f6",
    isSelected: false,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-cat-001",
    onClick: () => {},
    onHover: () => {},
  },
};

export const Selected: Story = {
  args: {
    requirement: baseRequirement,
    workstreamColor: "#3b82f6",
    isSelected: true,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-cat-001-selected",
    onClick: () => {},
    onHover: () => {},
  },
};

export const Dimmed: Story = {
  args: {
    requirement: baseRequirement,
    workstreamColor: "#3b82f6",
    isSelected: false,
    isDimmed: true,
    stackIndex: 0,
    dotId: "dot-cat-001-dimmed",
    onClick: () => {},
    onHover: () => {},
  },
};

export const AtRisk: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      id: "req-chk-001",
      refId: "CHK-001",
      health: "at_risk",
    },
    workstreamColor: "#10b981",
    isSelected: false,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-chk-001",
    onClick: () => {},
    onHover: () => {},
  },
};

export const Blocked: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      id: "req-cat-005",
      refId: "CAT-005",
      health: "blocked",
    },
    workstreamColor: "#3b82f6",
    isSelected: false,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-cat-005",
    onClick: () => {},
    onHover: () => {},
  },
};

export const OrderWorkstreamColor: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      id: "req-ord-001",
      refId: "ORD-001",
      workstreamId: "ws-orders",
    },
    workstreamColor: "#f59e0b",
    isSelected: false,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-ord-001",
    onClick: () => {},
    onHover: () => {},
  },
};

export const ClickInteraction: Story = {
  args: {
    requirement: baseRequirement,
    workstreamColor: "#3b82f6",
    isSelected: false,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-cat-001-click",
    onClick: () => {},
    onHover: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");
    await userEvent.click(button);
  },
};

export const Mobile: Story = {
  args: {
    requirement: baseRequirement,
    workstreamColor: "#3b82f6",
    isSelected: false,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-cat-001-mobile",
    onClick: () => {},
    onHover: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    requirement: { ...baseRequirement, health: "at_risk" },
    workstreamColor: "#10b981",
    isSelected: true,
    isDimmed: false,
    stackIndex: 0,
    dotId: "dot-cat-001-tablet",
    onClick: () => {},
    onHover: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
