import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { PipelineMetroMap } from "./PipelineMetroMap";
import { MOCK_REQUIREMENTS, MOCK_WORKSTREAMS, PIPELINE_STAGES } from "./pipeline-mock-data";

const meta: Meta<typeof PipelineMetroMap> = {
  title: "PipelineLab/PipelineMetroMap",
  component: PipelineMetroMap,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof PipelineMetroMap>;

export const Default: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: null,
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const WithSelectedRequirement: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: "req-cat-003",
    activeWorkstreamFilter: null,
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const FilteredToCatalog: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: "ws-catalog",
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const FilteredToCheckout: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: "ws-checkout",
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const FilteredToOrders: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: "ws-orders",
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const HighlightedSprintPlanning: Story = {
  name: "Highlighted: Sprint Planning (bottleneck)",
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: null,
    highlightedStage: "sprint_planning",
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const HighlightedImplementation: Story = {
  name: "Highlighted: Implementation",
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: null,
    highlightedStage: "implementation",
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const FilterAndHighlightCombined: Story = {
  name: "Filter + Highlight Combined",
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: "ws-catalog",
    highlightedStage: "implementation",
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const EmptyRequirements: Story = {
  args: {
    requirements: [],
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: null,
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
};

export const ClickStationHeader: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: null,
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the first station header button (Discovery)
    const buttons = canvas.getAllByRole("button");
    await userEvent.click(buttons[0]);
  },
};

export const Mobile: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: null,
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    requirements: MOCK_REQUIREMENTS,
    workstreams: MOCK_WORKSTREAMS,
    stages: PIPELINE_STAGES,
    selectedId: null,
    activeWorkstreamFilter: "ws-checkout",
    highlightedStage: null,
    onSelectRequirement: () => {},
    onHoverRequirement: () => {},
    onHighlightStage: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
