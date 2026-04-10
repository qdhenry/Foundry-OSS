import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import { TaskCard } from "./TaskCard";

const meta: Meta<typeof TaskCard> = {
  title: "Tasks/TaskCard",
  component: TaskCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    task: { control: "object" },
    programId: { control: "text" },
    compact: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof TaskCard>;

const baseTask = {
  _id: "task_001",
  title: "Set up Stripe payment intent endpoint",
  description:
    "Create Convex action to initialize PaymentIntent with cart total and metadata. Handle idempotency keys using cartId.",
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
};

export const Default: Story = {
  args: {
    task: baseTask,
    programId: "prog_acme",
    compact: false,
  },
};

export const Compact: Story = {
  args: {
    task: baseTask,
    programId: "prog_acme",
    compact: true,
  },
};

// Priority variants

export const PriorityCritical: Story = {
  name: "Priority — Critical",
  args: {
    task: { ...baseTask, priority: "critical" },
    programId: "prog_acme",
  },
};

export const PriorityHigh: Story = {
  name: "Priority — High",
  args: {
    task: {
      ...baseTask,
      _id: "task_002",
      priority: "high",
      title: "Implement cart persistence across sessions",
    },
    programId: "prog_acme",
  },
};

export const PriorityMedium: Story = {
  name: "Priority — Medium",
  args: {
    task: {
      ...baseTask,
      _id: "task_003",
      priority: "medium",
      title: "Build address validation service",
    },
    programId: "prog_acme",
  },
};

export const PriorityLow: Story = {
  name: "Priority — Low",
  args: {
    task: {
      ...baseTask,
      _id: "task_004",
      priority: "low",
      title: "Design order confirmation email template",
    },
    programId: "prog_acme",
  },
};

// Status variants

export const StatusBacklog: Story = {
  name: "Status — Backlog",
  args: {
    task: { ...baseTask, status: "backlog" as const },
    programId: "prog_acme",
  },
};

export const StatusTodo: Story = {
  name: "Status — To Do",
  args: {
    task: { ...baseTask, status: "todo" as const },
    programId: "prog_acme",
  },
};

export const StatusInProgress: Story = {
  name: "Status — In Progress",
  args: {
    task: { ...baseTask, status: "in_progress" as const },
    programId: "prog_acme",
  },
};

export const StatusReview: Story = {
  name: "Status — Review",
  args: {
    task: { ...baseTask, status: "review" as const },
    programId: "prog_acme",
  },
};

export const StatusDone: Story = {
  name: "Status — Done",
  args: {
    task: { ...baseTask, status: "done" as const },
    programId: "prog_acme",
  },
};

// Subtask progress variants

export const SubtasksInProgress: Story = {
  name: "Subtasks — In Progress",
  args: {
    task: {
      ...baseTask,
      hasSubtasks: true,
      subtaskCount: 8,
      subtasksCompleted: 3,
      subtasksFailed: 0,
    },
    programId: "prog_acme",
  },
};

export const SubtasksWithFailures: Story = {
  name: "Subtasks — With Failures",
  args: {
    task: {
      ...baseTask,
      hasSubtasks: true,
      subtaskCount: 6,
      subtasksCompleted: 2,
      subtasksFailed: 2,
    },
    programId: "prog_acme",
  },
};

export const SubtasksAllComplete: Story = {
  name: "Subtasks — All Complete",
  args: {
    task: {
      ...baseTask,
      status: "done" as const,
      hasSubtasks: true,
      subtaskCount: 5,
      subtasksCompleted: 5,
      subtasksFailed: 0,
    },
    programId: "prog_acme",
  },
};

export const NoSubtasks: Story = {
  name: "No Subtasks",
  args: {
    task: {
      ...baseTask,
      hasSubtasks: false,
      subtaskCount: undefined,
      subtasksCompleted: undefined,
      subtasksFailed: undefined,
    },
    programId: "prog_acme",
  },
};

// Overdue

export const Overdue: Story = {
  args: {
    task: {
      ...baseTask,
      status: "in_progress" as const,
      dueDate: new Date("2025-12-15").getTime(),
    },
    programId: "prog_acme",
  },
};

// Minimal data

export const MinimalData: Story = {
  args: {
    task: {
      _id: "task_min",
      title: "Write unit tests for payment module",
      priority: "medium" as const,
      status: "backlog" as const,
    },
    programId: "prog_acme",
  },
};

// Long title

export const LongTitle: Story = {
  args: {
    task: {
      ...baseTask,
      _id: "task_long",
      title:
        "Migrate entire B2B product catalog including pricing tiers, customer-specific overrides, and contract pricing from legacy Magento instance to Salesforce B2B Commerce Cloud",
    },
    programId: "prog_acme",
  },
};

// Interactive: open status menu

export const InteractiveStatusMenu: Story = {
  args: {
    task: baseTask,
    programId: "prog_acme",
    compact: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statusButton = canvas.getByRole("button", { name: /in progress/i });
    await userEvent.click(statusButton);
    await expect(canvas.getByText("To Do")).toBeInTheDocument();
    await expect(canvas.getByText("Review")).toBeInTheDocument();
    await expect(canvas.getByText("Done")).toBeInTheDocument();
  },
};

export const Mobile: Story = {
  args: {
    task: baseTask,
    programId: "prog_acme",
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    task: baseTask,
    programId: "prog_acme",
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
