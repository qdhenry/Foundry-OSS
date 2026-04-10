import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { PipelineStageFilter } from "./PipelineStageFilter";

const meta = {
  title: "Pipeline/PipelineStageFilter",
  component: PipelineStageFilter,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseArgs = {
  activeStage: null,
  activePriority: null,
  searchQuery: "",
  onStageChange: fn(),
  onPriorityChange: fn(),
  onSearchChange: fn(),
};

export const Default: Story = {
  args: baseArgs,
};

export const WithActiveStageFilter: Story = {
  args: {
    ...baseArgs,
    activeStage: "implementation" as const,
  },
};

export const WithActivePriorityFilter: Story = {
  args: {
    ...baseArgs,
    activePriority: "must_have",
  },
};

export const WithSearchQuery: Story = {
  args: {
    ...baseArgs,
    searchQuery: "account management",
  },
};

export const AllFiltersActive: Story = {
  args: {
    activeStage: "sprint_planning" as const,
    activePriority: "should_have",
    searchQuery: "billing",
    onStageChange: fn(),
    onPriorityChange: fn(),
    onSearchChange: fn(),
  },
};

export const Mobile: Story = {
  args: baseArgs,
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: baseArgs,
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const TypeInSearch: Story = {
  args: baseArgs,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchInput = canvas.getByPlaceholderText(/search requirements/i);
    await userEvent.click(searchInput);
    await userEvent.type(searchInput, "customer portal");
  },
};

export const ClearFilters: Story = {
  args: {
    ...baseArgs,
    activeStage: "implementation" as const,
    activePriority: "must_have",
    searchQuery: "checkout",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.getByRole("button", { name: /clear filters/i });
    await userEvent.click(clearButton);
  },
};
