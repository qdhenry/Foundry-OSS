import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { useState } from "react";
import type { IntegrationFilterValues } from "./IntegrationFilters";
import { IntegrationFilters } from "./IntegrationFilters";

const meta: Meta<typeof IntegrationFilters> = {
  title: "Integrations/IntegrationFilters",
  component: IntegrationFilters,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    onFilterChange: { action: "filterChanged" },
  },
};

export default meta;
type Story = StoryObj<typeof IntegrationFilters>;

export const Default: Story = {
  args: {
    filters: {},
    onFilterChange: fn(),
  },
};

export const FilterByType: Story = {
  name: "With Type Filter Active",
  args: {
    filters: { type: "api" },
    onFilterChange: fn(),
  },
};

export const FilterByStatus: Story = {
  name: "With Status Filter Active",
  args: {
    filters: { status: "live" },
    onFilterChange: fn(),
  },
};

export const BothFiltersActive: Story = {
  name: "Both Filters Active",
  args: {
    filters: { type: "webhook", status: "testing" },
    onFilterChange: fn(),
  },
};

export const TypeWebhookFilterActive: Story = {
  name: "Type: Webhook Selected",
  args: {
    filters: { type: "webhook" },
    onFilterChange: fn(),
  },
};

export const TypeFileTransferFilterActive: Story = {
  name: "Type: File Transfer Selected",
  args: {
    filters: { type: "file_transfer" },
    onFilterChange: fn(),
  },
};

export const StatusDeprecatedFilterActive: Story = {
  name: "Status: Deprecated Selected",
  args: {
    filters: { status: "deprecated" },
    onFilterChange: fn(),
  },
};

export const StatusInProgressFilterActive: Story = {
  name: "Status: In Progress Selected",
  args: {
    filters: { status: "in_progress" },
    onFilterChange: fn(),
  },
};

// Controlled story showing real interactivity
const ControlledFilters = () => {
  const [filters, setFilters] = useState<IntegrationFilterValues>({});
  return (
    <div className="space-y-4">
      <IntegrationFilters filters={filters} onFilterChange={setFilters} />
      <div className="rounded-md border border-border-default bg-surface-raised p-3 text-xs text-text-secondary">
        <strong className="text-text-primary">Active filters:</strong>{" "}
        {Object.keys(filters).length === 0 ? "None" : JSON.stringify(filters, null, 2)}
      </div>
    </div>
  );
};

export const Interactive: Story = {
  name: "Interactive (Controlled)",
  render: () => <ControlledFilters />,
};

export const ClearFiltersInteraction: Story = {
  name: "Clear Filters Interaction",
  args: {
    filters: { type: "api", status: "live" },
    onFilterChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const clearButton = canvas.getByText("Clear filters");
    await expect(clearButton).toBeInTheDocument();
    await userEvent.click(clearButton);
    await expect(args.onFilterChange).toHaveBeenCalledWith({});
  },
};

export const SelectTypeInteraction: Story = {
  name: "Select Type Filter Interaction",
  args: {
    filters: {},
    onFilterChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const typeSelect = canvas.getAllByRole("combobox")[0];
    await userEvent.selectOptions(typeSelect, "api");
    await expect(args.onFilterChange).toHaveBeenCalledWith({ type: "api" });
  },
};

export const SelectStatusInteraction: Story = {
  name: "Select Status Filter Interaction",
  args: {
    filters: {},
    onFilterChange: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const statusSelect = canvas.getAllByRole("combobox")[1];
    await userEvent.selectOptions(statusSelect, "live");
    await expect(args.onFilterChange).toHaveBeenCalledWith({ status: "live" });
  },
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  args: {
    filters: { type: "api" },
    onFilterChange: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  args: {
    filters: { type: "webhook", status: "testing" },
    onFilterChange: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
