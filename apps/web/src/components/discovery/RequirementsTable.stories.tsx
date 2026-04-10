import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { RequirementsTable } from "./RequirementsTable";

const mockWorkstreams = [
  { _id: "ws-1", name: "Catalog & PIM", shortCode: "CAT" },
  { _id: "ws-2", name: "Checkout & Payments", shortCode: "CHK" },
  { _id: "ws-3", name: "Order Management", shortCode: "ORD" },
  { _id: "ws-4", name: "Customer Accounts", shortCode: "CST" },
  { _id: "ws-5", name: "Reporting & Analytics", shortCode: "RPT" },
];

const mockRequirements = [
  {
    _id: "req-1",
    refId: "BM-001",
    title: "Product catalog migration from Magento to Salesforce B2B Commerce",
    batch: "Batch 1",
    priority: "must_have" as const,
    fitGap: "custom_dev" as const,
    effortEstimate: "high" as const,
    status: "approved" as const,
    workstreamId: "ws-1",
  },
  {
    _id: "req-2",
    refId: "BM-002",
    title: "B2B pricing rules and tiered discount configuration",
    batch: "Batch 1",
    priority: "must_have" as const,
    fitGap: "config" as const,
    effortEstimate: "medium" as const,
    status: "in_progress" as const,
    workstreamId: "ws-2",
  },
  {
    _id: "req-3",
    refId: "BM-003",
    title: "Purchase order workflow and net terms payment support",
    batch: "Batch 2",
    priority: "must_have" as const,
    fitGap: "custom_dev" as const,
    effortEstimate: "very_high" as const,
    status: "draft" as const,
    workstreamId: "ws-2",
  },
  {
    _id: "req-4",
    refId: "BM-004",
    title: "Customer account hierarchy management and buyer roles",
    batch: "Batch 2",
    priority: "should_have" as const,
    fitGap: "native" as const,
    effortEstimate: "low" as const,
    status: "approved" as const,
    workstreamId: "ws-4",
  },
  {
    _id: "req-5",
    refId: "BM-005",
    title: "ERP order sync integration via REST API",
    batch: "Batch 2",
    priority: "must_have" as const,
    fitGap: "third_party" as const,
    effortEstimate: "high" as const,
    status: "draft" as const,
    workstreamId: "ws-3",
  },
  {
    _id: "req-6",
    refId: "BM-006",
    title: "Real-time inventory visibility across distribution centers",
    batch: "Batch 3",
    priority: "should_have" as const,
    fitGap: "custom_dev" as const,
    effortEstimate: "high" as const,
    status: "draft" as const,
    workstreamId: "ws-1",
  },
  {
    _id: "req-7",
    refId: "BM-007",
    title: "Sales rep quote management and approval workflow",
    batch: "Batch 3",
    priority: "nice_to_have" as const,
    fitGap: "config" as const,
    effortEstimate: "medium" as const,
    status: "deferred" as const,
    workstreamId: "ws-4",
  },
  {
    _id: "req-8",
    refId: "BM-008",
    title: "Advanced reporting dashboard for operations team",
    batch: "Batch 4",
    priority: "nice_to_have" as const,
    fitGap: "third_party" as const,
    effortEstimate: undefined,
    status: "draft" as const,
    workstreamId: "ws-5",
  },
  {
    _id: "req-9",
    refId: "BM-009",
    title: "Legacy EDI integration with hospital procurement systems",
    batch: "Batch 3",
    priority: "deferred" as const,
    fitGap: "not_feasible" as const,
    effortEstimate: "very_high" as const,
    status: "deferred" as const,
    workstreamId: undefined,
  },
  {
    _id: "req-10",
    refId: "BM-010",
    title: "Regulatory compliance documentation for regulated products",
    batch: "Batch 1",
    priority: "must_have" as const,
    fitGap: "custom_dev" as const,
    effortEstimate: "high" as const,
    status: "complete" as const,
    workstreamId: "ws-3",
  },
];

const meta: Meta<typeof RequirementsTable> = {
  title: "Discovery/RequirementsTable",
  component: RequirementsTable,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onSelect: fn(),
    workstreams: mockWorkstreams,
  },
};

export default meta;
type Story = StoryObj<typeof RequirementsTable>;

export const Default: Story = {
  args: {
    requirements: mockRequirements,
    selectedId: null,
  },
};

export const WithSelectedRow: Story = {
  name: "With Selected Row",
  args: {
    requirements: mockRequirements,
    selectedId: "req-2",
  },
};

export const Empty: Story = {
  args: {
    requirements: [],
    selectedId: null,
  },
};

export const SingleRequirement: Story = {
  name: "Single Requirement",
  args: {
    requirements: [mockRequirements[0]],
    selectedId: null,
  },
};

export const MissingOptionalFields: Story = {
  name: "Missing Optional Fields",
  args: {
    requirements: mockRequirements.map((r) => ({
      ...r,
      batch: undefined,
      effortEstimate: undefined,
      workstreamId: undefined,
    })),
    selectedId: null,
  },
};

export const ColumnSortInteraction: Story = {
  name: "Sort by Column (interaction)",
  args: {
    requirements: mockRequirements,
    selectedId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const titleHeader = canvas.getByText("Title");
    await userEvent.click(titleHeader);
    const priorityHeader = canvas.getByText("Priority");
    await userEvent.click(priorityHeader);
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  args: {
    requirements: mockRequirements.slice(0, 4),
    selectedId: null,
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  args: {
    requirements: mockRequirements,
    selectedId: null,
  },
};
