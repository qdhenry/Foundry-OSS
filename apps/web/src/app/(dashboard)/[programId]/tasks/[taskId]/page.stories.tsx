import { SandboxHUDProvider } from "@foundry/ui/sandbox/SandboxHUDContext";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import React from "react";
import TaskDetailPage from "./page";

const MOCK_TASK = {
  _id: "task-1",
  _creationTime: Date.now() - 5 * 86400000,
  orgId: "org_foundry_demo",
  programId: "prog-acme-demo",
  title: "Implement SKU mapping logic",
  description:
    "Map Magento SKUs to Salesforce product codes using the transformation rules defined in FOUND-12. Handle edge cases for bundle products and configurable variants.",
  status: "in_progress",
  priority: "high",
  assigneeId: "user-1",
  assigneeName: "Sarah Chen",
  workstreamId: "ws-1",
  sprintId: "sprint-3",
  dueDate: Date.now() + 7 * 86400000,
  hasSubtasks: true,
  subtaskGenerationStatus: "complete",
  requirementId: "req-1",
  requirementRefId: "FOUND-12",
  requirementTitle: "Product SKU Mapping",
  resolvedBlockedBy: [],
};

const MOCK_WORKSTREAMS = [
  { _id: "ws-1", name: "Product Data Migration", shortCode: "PDM" },
  { _id: "ws-2", name: "Order History Transfer", shortCode: "OHT" },
  { _id: "ws-3", name: "Customer Accounts", shortCode: "CA" },
];

const MOCK_SPRINTS = [
  { _id: "sprint-1", name: "Sprint 1", workstreamId: "ws-1" },
  { _id: "sprint-2", name: "Sprint 2", workstreamId: "ws-1" },
  { _id: "sprint-3", name: "Sprint 3", workstreamId: "ws-1" },
];

const MOCK_TEAM_MEMBERS = [
  { userId: "user-1", role: "engineer", user: { name: "Sarah Chen" } },
  { userId: "user-2", role: "lead", user: { name: "Alex Kim" } },
  { userId: "user-3", role: "engineer", user: { name: "Priya Nair" } },
];

const meta = {
  title: "Pages/Tasks/Detail",
  component: TaskDetailPage,
  tags: ["autodocs"],
  decorators: [
    (Story) => React.createElement(SandboxHUDProvider, null, React.createElement(Story)),
  ],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/tasks/task-1",
        params: { programId: "prog-acme-demo", taskId: "task-1" },
      },
    },
    convexMockData: {
      "tasks:get": MOCK_TASK,
      "workstreams:listByProgram": MOCK_WORKSTREAMS,
      "sprints:listByProgram": MOCK_SPRINTS,
      "teamMembers:listByProgram": MOCK_TEAM_MEMBERS,
    },
  },
} satisfies Meta<typeof TaskDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BacklogTask: Story = {
  parameters: {
    convexMockData: {
      ...meta.parameters.convexMockData,
      "tasks:get": {
        ...MOCK_TASK,
        status: "backlog",
        priority: "low",
        assigneeId: null,
        assigneeName: null,
        sprintId: null,
        dueDate: null,
        hasSubtasks: false,
        description: null,
        requirementId: null,
        requirementRefId: null,
        requirementTitle: null,
        title: "Write integration tests for order pipeline",
      },
    },
  },
};

export const OverdueTask: Story = {
  parameters: {
    convexMockData: {
      ...meta.parameters.convexMockData,
      "tasks:get": {
        ...MOCK_TASK,
        dueDate: Date.now() - 3 * 86400000,
        title: "Build customer account sync service",
        status: "review",
        priority: "critical",
      },
    },
  },
};

export const WithBlockers: Story = {
  parameters: {
    convexMockData: {
      ...meta.parameters.convexMockData,
      "tasks:get": {
        ...MOCK_TASK,
        status: "todo",
        resolvedBlockedBy: [
          { _id: "task-2", title: "Write category import script", status: "done" },
          { _id: "task-5", title: "Build customer account sync service", status: "in_progress" },
        ],
      },
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
