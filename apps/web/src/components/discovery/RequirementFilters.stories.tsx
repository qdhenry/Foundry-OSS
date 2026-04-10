import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { RequirementFilters } from "./RequirementFilters";

const mockWorkstreams = [
  { _id: "ws-1", name: "Catalog & PIM" },
  { _id: "ws-2", name: "Checkout & Payments" },
  { _id: "ws-3", name: "Order Management" },
  { _id: "ws-4", name: "Customer Accounts" },
  { _id: "ws-5", name: "Reporting & Analytics" },
  { _id: "ws-6", name: "Integrations" },
  { _id: "ws-7", name: "Platform Infrastructure" },
];

const mockBatches = ["Batch 1", "Batch 2", "Batch 3", "Batch 4"];

const meta: Meta<typeof RequirementFilters> = {
  title: "Discovery/RequirementFilters",
  component: RequirementFilters,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onFilterChange: fn(),
    workstreams: mockWorkstreams,
    batches: mockBatches,
  },
};

export default meta;
type Story = StoryObj<typeof RequirementFilters>;

export const Default: Story = {
  args: {
    filters: {},
  },
};

export const WithPriorityFilter: Story = {
  args: {
    filters: {
      priority: "must_have",
    },
  },
};

export const WithStatusFilter: Story = {
  args: {
    filters: {
      status: "in_progress",
    },
  },
};

export const WithBatchFilter: Story = {
  args: {
    filters: {
      batch: "Batch 2",
    },
  },
};

export const WithWorkstreamFilter: Story = {
  args: {
    filters: {
      workstreamId: "ws-2",
    },
  },
};

export const AllFiltersActive: Story = {
  name: "All Filters Active",
  args: {
    filters: {
      batch: "Batch 1",
      priority: "must_have",
      status: "approved",
      workstreamId: "ws-1",
    },
  },
};

export const NoWorkstreams: Story = {
  name: "No Workstreams",
  args: {
    filters: {},
    workstreams: [],
    batches: [],
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    filters: {
      priority: "must_have",
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  args: {
    filters: {},
  },
};
