import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { InstanceCard } from "./InstanceCard";

const baseTasks = [
  { _id: "task_001", title: "Discovery & Requirements Gathering", status: "done" },
  { _id: "task_002", title: "Data Mapping & Cleansing", status: "done" },
  { _id: "task_003", title: "Integration Architecture Design", status: "in_progress" },
  { _id: "task_004", title: "Sandbox Build & Testing", status: "todo" },
  { _id: "task_005", title: "UAT & Sign-off", status: "backlog" },
  { _id: "task_006", title: "Go-Live & Hypercare", status: "backlog" },
];

const baseInstance = {
  _id: "instance_001",
  name: "AcmeCorp — Q1 2026 Run",
  status: "active" as const,
  startedAt: Date.now() - 14 * 24 * 3600 * 1000, // 14 days ago
  totalTasks: 6,
  doneTasks: 2,
  taskSummaries: baseTasks,
};

const meta: Meta<typeof InstanceCard> = {
  title: "Playbooks/InstanceCard",
  component: InstanceCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    instance: baseInstance,
  },
};

export default meta;
type Story = StoryObj<typeof InstanceCard>;

export const Active: Story = {
  name: "Active Instance — In Progress",
};

export const Completed: Story = {
  name: "Completed Instance",
  args: {
    instance: {
      ...baseInstance,
      _id: "instance_002",
      name: "Acme Corp — Migration Complete",
      status: "completed",
      startedAt: Date.now() - 90 * 24 * 3600 * 1000,
      completedAt: Date.now() - 5 * 24 * 3600 * 1000,
      totalTasks: 6,
      doneTasks: 6,
      taskSummaries: baseTasks.map((t) => ({ ...t, status: "done" })),
    },
  },
};

export const Cancelled: Story = {
  name: "Cancelled Instance",
  args: {
    instance: {
      ...baseInstance,
      _id: "instance_003",
      name: "Paused Project — Cancelled",
      status: "cancelled",
      totalTasks: 6,
      doneTasks: 1,
      taskSummaries: baseTasks,
    },
  },
};

export const NoTasks: Story = {
  name: "No Tasks",
  args: {
    instance: {
      ...baseInstance,
      totalTasks: 0,
      doneTasks: 0,
      taskSummaries: [],
    },
  },
};

export const FullProgress: Story = {
  name: "Full Progress — 100%",
  args: {
    instance: {
      ...baseInstance,
      totalTasks: 6,
      doneTasks: 6,
      taskSummaries: baseTasks.map((t) => ({ ...t, status: "done" })),
    },
  },
};

export const TasksExpanded: Story = {
  name: "Tasks Expanded",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const showButton = canvas.getByRole("button", { name: /show tasks/i });
    await userEvent.click(showButton);
  },
};

export const GridLayout: Story = {
  name: "Grid — Multiple Cards",
  render: (args) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <InstanceCard {...args} instance={{ ...baseInstance, status: "active" }} />
      <InstanceCard
        {...args}
        instance={{
          ...baseInstance,
          _id: "instance_002",
          name: "Completed Run",
          status: "completed",
          doneTasks: 6,
          taskSummaries: baseTasks.map((t) => ({ ...t, status: "done" })),
        }}
      />
    </div>
  ),
};

export const Mobile: Story = {
  name: "Mobile Viewport",
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  name: "Tablet Viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
