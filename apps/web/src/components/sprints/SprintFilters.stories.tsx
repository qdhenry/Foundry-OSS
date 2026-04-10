import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { SprintFilters } from "./SprintFilters";

const meta: Meta<typeof SprintFilters> = {
  title: "Sprints/SprintFilters",
  component: SprintFilters,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onWorkstreamFilterChange: fn(),
    onStatusFilterChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SprintFilters>;

const mockWorkstreams = [
  { _id: "ws_001", name: "Commerce" },
  { _id: "ws_002", name: "Platform" },
  { _id: "ws_003", name: "Integrations" },
  { _id: "ws_004", name: "Mobile" },
  { _id: "ws_005", name: "Analytics" },
];

export const Default: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "",
    statusFilter: "",
  },
};

export const WorkstreamSelected: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "ws_001",
    statusFilter: "",
  },
};

export const StatusSelected: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "",
    statusFilter: "active",
  },
};

export const BothFiltersActive: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "ws_002",
    statusFilter: "completed",
  },
};

export const NoWorkstreams: Story = {
  args: {
    workstreams: [],
    workstreamFilter: "",
    statusFilter: "",
  },
};

export const SingleWorkstream: Story = {
  args: {
    workstreams: [{ _id: "ws_001", name: "Commerce" }],
    workstreamFilter: "",
    statusFilter: "",
  },
};

export const InteractiveStatusChange: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "",
    statusFilter: "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statusSelect = canvas.getAllByRole("combobox")[1];
    await userEvent.selectOptions(statusSelect, "active");
  },
};

export const InteractiveWorkstreamChange: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "",
    statusFilter: "",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const workstreamSelect = canvas.getAllByRole("combobox")[0];
    await userEvent.selectOptions(workstreamSelect, "ws_003");
  },
};

export const Mobile: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "",
    statusFilter: "",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    workstreams: mockWorkstreams,
    workstreamFilter: "ws_001",
    statusFilter: "active",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
