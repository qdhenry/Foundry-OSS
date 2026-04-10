import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { TaskFilters } from "./TaskFilters";

const meta: Meta<typeof TaskFilters> = {
  title: "Tasks/TaskFilters",
  component: TaskFilters,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onStatusChange: fn(),
    onPriorityChange: fn(),
    onWorkstreamChange: fn(),
    onSprintChange: fn(),
    onViewModeChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TaskFilters>;

const mockWorkstreams = [
  { _id: "ws_001", name: "Commerce", shortCode: "COM" },
  { _id: "ws_002", name: "Platform", shortCode: "PLT" },
  { _id: "ws_003", name: "Catalog", shortCode: "CAT" },
  { _id: "ws_004", name: "Account Management", shortCode: "ACC" },
  { _id: "ws_005", name: "Integrations", shortCode: "INT" },
];

const mockSprints = [
  { _id: "spr_001", name: "Sprint 1 — Foundation", workstreamId: "ws_002" },
  { _id: "spr_002", name: "Sprint 2 — Catalog Migration", workstreamId: "ws_003" },
  { _id: "spr_003", name: "Sprint 3 — Checkout & Payments", workstreamId: "ws_001" },
  { _id: "spr_004", name: "Sprint 4 — Account Management", workstreamId: "ws_004" },
  { _id: "spr_005", name: "Sprint 5 — Integrations", workstreamId: "ws_005" },
];

export const Default: Story = {
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const BoardView: Story = {
  name: "View — Board",
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const ListView: Story = {
  name: "View — List",
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "list",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const StatusFiltered: Story = {
  name: "Filter — Status (In Progress)",
  args: {
    status: "in_progress",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const PriorityFiltered: Story = {
  name: "Filter — Priority (Critical)",
  args: {
    status: "",
    priority: "critical",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const WorkstreamFiltered: Story = {
  name: "Filter — Workstream (Commerce)",
  args: {
    status: "",
    priority: "",
    workstreamId: "ws_001",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const WorkstreamAndSprintFiltered: Story = {
  name: "Filter — Workstream + Sprint",
  args: {
    status: "",
    priority: "",
    workstreamId: "ws_001",
    sprintId: "spr_003",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const AllFiltersActive: Story = {
  name: "Filter — All Active",
  args: {
    status: "in_progress",
    priority: "high",
    workstreamId: "ws_001",
    sprintId: "spr_003",
    viewMode: "list",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
};

export const NoWorkstreamsOrSprints: Story = {
  name: "No Workstreams or Sprints",
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: undefined,
    sprints: undefined,
  },
};

export const EmptyWorkstreams: Story = {
  name: "Empty Workstreams List",
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: [],
    sprints: [],
  },
};

export const InteractiveToggleView: Story = {
  name: "Interactive — Toggle to List View",
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const listButton = canvas.getByRole("button", { name: /list/i });
    await userEvent.click(listButton);
    await expect(args.onViewModeChange).toHaveBeenCalledWith("list");
  },
};

export const InteractiveStatusSelect: Story = {
  name: "Interactive — Select Status",
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const selects = canvas.getAllByRole("combobox");
    // First combobox is status
    await userEvent.selectOptions(selects[0], "review");
    await expect(args.onStatusChange).toHaveBeenCalledWith("review");
  },
};

export const InteractiveClearFilters: Story = {
  name: "Interactive — Clear Filters",
  args: {
    status: "in_progress",
    priority: "critical",
    workstreamId: "ws_001",
    sprintId: "spr_003",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const clearBtn = canvas.getByRole("button", { name: /clear filters/i });
    await userEvent.click(clearBtn);
    await expect(args.onStatusChange).toHaveBeenCalledWith("");
    await expect(args.onPriorityChange).toHaveBeenCalledWith("");
    await expect(args.onWorkstreamChange).toHaveBeenCalledWith("");
    await expect(args.onSprintChange).toHaveBeenCalledWith("");
  },
};

export const Mobile: Story = {
  args: {
    status: "",
    priority: "",
    workstreamId: "",
    sprintId: "",
    viewMode: "board",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    status: "in_progress",
    priority: "high",
    workstreamId: "ws_001",
    sprintId: "",
    viewMode: "list",
    workstreams: mockWorkstreams,
    sprints: mockSprints,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
