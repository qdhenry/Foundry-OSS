import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import NewTaskPage from "./page";

const MOCK_WORKSTREAMS = [
  { _id: "ws-1", name: "Product Data Migration", shortCode: "PDM" },
  { _id: "ws-2", name: "Order History Transfer", shortCode: "OHT" },
  { _id: "ws-3", name: "Customer Accounts", shortCode: "CA" },
];

const MOCK_SPRINTS = [
  { _id: "sprint-1", name: "Sprint 1", workstreamId: "ws-1" },
  { _id: "sprint-2", name: "Sprint 2", workstreamId: "ws-1" },
  { _id: "sprint-3", name: "Sprint 3", workstreamId: "ws-1" },
  { _id: "sprint-4", name: "Sprint 1", workstreamId: "ws-2" },
  { _id: "sprint-5", name: "Sprint 2", workstreamId: "ws-2" },
];

const MOCK_TEAM_MEMBERS = [
  { userId: "user-1", role: "engineer", user: { name: "Sarah Chen" } },
  { userId: "user-2", role: "lead", user: { name: "Alex Kim" } },
  { userId: "user-3", role: "engineer", user: { name: "Priya Nair" } },
  { userId: "user-4", role: "engineer", user: { name: "Marcus Rivera" } },
];

const MOCK_REQUIREMENTS = [
  { _id: "req-1", refId: "FOUND-12", title: "Product SKU Mapping" },
  { _id: "req-2", refId: "FOUND-15", title: "Category Hierarchy Migration" },
  { _id: "req-3", refId: "FOUND-23", title: "Order Data Validation Rules" },
  { _id: "req-4", refId: "FOUND-31", title: "Customer Account Sync" },
  { _id: "req-5", refId: "FOUND-42", title: "Pricing Tier Engine" },
];

const MOCK_EXISTING_TASKS = [
  { _id: "task-1", title: "Implement SKU mapping logic", status: "in_progress" },
  { _id: "task-2", title: "Write category import script", status: "done" },
  { _id: "task-3", title: "Set up order validation pipeline", status: "todo" },
  { _id: "task-4", title: "Configure Salesforce API rate limiting", status: "backlog" },
];

const meta = {
  title: "Pages/Tasks/New",
  component: NewTaskPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/prog-acme-demo/tasks/new",
        params: { programId: "prog-acme-demo" },
      },
    },
    convexMockData: {
      "workstreams:listByProgram": MOCK_WORKSTREAMS,
      "sprints:listByProgram": MOCK_SPRINTS,
      "teamMembers:listByProgram": MOCK_TEAM_MEMBERS,
      "requirements:listByProgram": MOCK_REQUIREMENTS,
      "tasks:listByProgram": MOCK_EXISTING_TASKS,
    },
  },
} satisfies Meta<typeof NewTaskPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "workstreams:listByProgram": [],
      "sprints:listByProgram": [],
      "teamMembers:listByProgram": [],
      "requirements:listByProgram": [],
      "tasks:listByProgram": [],
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
