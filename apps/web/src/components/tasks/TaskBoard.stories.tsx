import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TaskBoard } from "./TaskBoard";

const meta: Meta<typeof TaskBoard> = {
  title: "Tasks/TaskBoard",
  component: TaskBoard,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof TaskBoard>;

const mockTasks = [
  {
    _id: "task_001",
    title: "Set up Stripe payment intent endpoint",
    description: "Create Convex action to initialize PaymentIntent with cart total and metadata.",
    priority: "critical" as const,
    status: "in_progress" as const,
    assigneeName: "Sarah Chen",
    sprintName: "Sprint 3",
    workstreamShortCode: "COM",
    dueDate: new Date("2026-02-28").getTime(),
    hasSubtasks: true,
    subtaskCount: 5,
    subtasksCompleted: 2,
    subtasksFailed: 0,
  },
  {
    _id: "task_002",
    title: "Implement cart persistence across sessions",
    description:
      "Store cart state in Convex so users don't lose items on page refresh or device switch.",
    priority: "high" as const,
    status: "todo" as const,
    assigneeName: "Marcus Rivera",
    sprintName: "Sprint 3",
    workstreamShortCode: "COM",
    dueDate: new Date("2026-03-05").getTime(),
    hasSubtasks: false,
  },
  {
    _id: "task_003",
    title: "Build address validation service",
    description:
      "Integrate USPS address validation API for checkout form. Handle edge cases for PO boxes and APO addresses.",
    priority: "medium" as const,
    status: "todo" as const,
    assigneeName: "Priya Nair",
    sprintName: "Sprint 3",
    workstreamShortCode: "COM",
  },
  {
    _id: "task_004",
    title: "Design order confirmation email template",
    priority: "low" as const,
    status: "backlog" as const,
    workstreamShortCode: "COM",
  },
  {
    _id: "task_005",
    title: "Migrate product schema from Magento",
    description:
      "ETL pipeline for 14k SKUs including attributes, pricing tiers, and category mappings.",
    priority: "critical" as const,
    status: "review" as const,
    assigneeName: "James Park",
    sprintName: "Sprint 2",
    workstreamShortCode: "CAT",
    dueDate: new Date("2026-02-20").getTime(),
    hasSubtasks: true,
    subtaskCount: 8,
    subtasksCompleted: 8,
    subtasksFailed: 0,
  },
  {
    _id: "task_006",
    title: "Configure Clerk organizations for B2B tenants",
    priority: "high" as const,
    status: "done" as const,
    assigneeName: "Sarah Chen",
    sprintName: "Sprint 1",
    workstreamShortCode: "PLT",
  },
  {
    _id: "task_007",
    title: "Set up Convex schema and indexes",
    priority: "critical" as const,
    status: "done" as const,
    assigneeName: "Marcus Rivera",
    sprintName: "Sprint 1",
    workstreamShortCode: "PLT",
  },
  {
    _id: "task_008",
    title: "Implement purchase approval workflow",
    description: "Multi-level approval for orders over account spending limits.",
    priority: "high" as const,
    status: "backlog" as const,
    workstreamShortCode: "ACC",
    dueDate: new Date("2026-01-15").getTime(),
  },
  {
    _id: "task_009",
    title: "Build B2B pricing tier engine",
    description:
      "Support contract pricing, volume discounts, and customer-specific catalog overrides.",
    priority: "critical" as const,
    status: "in_progress" as const,
    assigneeName: "Priya Nair",
    sprintName: "Sprint 3",
    workstreamShortCode: "CAT",
    hasSubtasks: true,
    subtaskCount: 6,
    subtasksCompleted: 1,
    subtasksFailed: 1,
  },
  {
    _id: "task_010",
    title: "Write API integration tests",
    priority: "medium" as const,
    status: "todo" as const,
    assigneeName: "James Park",
    sprintName: "Sprint 3",
    workstreamShortCode: "PLT",
  },
];

export const Default: Story = {
  args: {
    tasks: mockTasks,
    programId: "prog_acme",
  },
};

export const EmptyBoard: Story = {
  args: {
    tasks: [],
    programId: "prog_acme",
  },
};

export const OnlyBacklog: Story = {
  args: {
    tasks: mockTasks.filter((t) => t.status === "backlog"),
    programId: "prog_acme",
  },
};

export const AllInProgress: Story = {
  args: {
    tasks: mockTasks.map((t) => ({ ...t, status: "in_progress" as const })),
    programId: "prog_acme",
  },
};

export const AllDone: Story = {
  args: {
    tasks: mockTasks.map((t) => ({ ...t, status: "done" as const })),
    programId: "prog_acme",
  },
};

export const WithOverdueTasks: Story = {
  args: {
    tasks: mockTasks.map((t) => ({
      ...t,
      dueDate: new Date("2025-12-01").getTime(),
    })),
    programId: "prog_acme",
  },
};

export const WithSubtaskProgress: Story = {
  args: {
    tasks: mockTasks.filter((t) => t.hasSubtasks),
    programId: "prog_acme",
  },
};

export const SingleTask: Story = {
  args: {
    tasks: [mockTasks[0]],
    programId: "prog_acme",
  },
};

export const CriticalTasksOnly: Story = {
  args: {
    tasks: mockTasks.filter((t) => t.priority === "critical"),
    programId: "prog_acme",
  },
};

export const Mobile: Story = {
  args: {
    tasks: mockTasks,
    programId: "prog_acme",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    tasks: mockTasks,
    programId: "prog_acme",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
