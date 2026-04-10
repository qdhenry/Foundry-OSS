import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MOCK_REQUIREMENTS, MOCK_WORKSTREAMS, PIPELINE_STAGES } from "./pipeline-mock-data";
import type { MockRequirement, MockWorkstream } from "./pipeline-types";
import { WorkstreamLine } from "./WorkstreamLine";

const catalogWorkstream: MockWorkstream = MOCK_WORKSTREAMS[0];
const checkoutWorkstream: MockWorkstream = MOCK_WORKSTREAMS[1];
const ordersWorkstream: MockWorkstream = MOCK_WORKSTREAMS[2];

const catalogRequirements: MockRequirement[] = MOCK_REQUIREMENTS.filter(
  (r) => r.workstreamId === "ws-catalog",
);
const checkoutRequirements: MockRequirement[] = MOCK_REQUIREMENTS.filter(
  (r) => r.workstreamId === "ws-checkout",
);
const ordersRequirements: MockRequirement[] = MOCK_REQUIREMENTS.filter(
  (r) => r.workstreamId === "ws-orders",
);

const meta: Meta<typeof WorkstreamLine> = {
  title: "PipelineLab/WorkstreamLine",
  component: WorkstreamLine,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof WorkstreamLine>;

export const Default: Story = {
  args: {
    workstream: catalogWorkstream,
    requirements: catalogRequirements,
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
};

export const CheckoutWorkstream: Story = {
  args: {
    workstream: checkoutWorkstream,
    requirements: checkoutRequirements,
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
};

export const OrdersWorkstream: Story = {
  args: {
    workstream: ordersWorkstream,
    requirements: ordersRequirements,
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
};

export const WithSelectedRequirement: Story = {
  args: {
    workstream: catalogWorkstream,
    requirements: catalogRequirements,
    stages: PIPELINE_STAGES,
    selectedId: "req-cat-003",
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
};

export const Dimmed: Story = {
  args: {
    workstream: catalogWorkstream,
    requirements: catalogRequirements,
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: true,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
};

export const HighlightedSprintPlanningStage: Story = {
  args: {
    workstream: catalogWorkstream,
    requirements: catalogRequirements,
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: "sprint_planning",
  },
};

export const HighlightedImplementationStage: Story = {
  args: {
    workstream: checkoutWorkstream,
    requirements: checkoutRequirements,
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: "implementation",
  },
};

export const EmptyWorkstream: Story = {
  args: {
    workstream: {
      id: "ws-empty",
      name: "Empty Workstream",
      shortCode: "EMP",
      color: "#6b7280",
      requirements: [],
    },
    requirements: [],
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
};

export const Mobile: Story = {
  args: {
    workstream: catalogWorkstream,
    requirements: catalogRequirements,
    stages: PIPELINE_STAGES,
    selectedId: null,
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    workstream: checkoutWorkstream,
    requirements: checkoutRequirements,
    stages: PIPELINE_STAGES,
    selectedId: "req-chk-001",
    dimmed: false,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    highlightedStage: null,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
