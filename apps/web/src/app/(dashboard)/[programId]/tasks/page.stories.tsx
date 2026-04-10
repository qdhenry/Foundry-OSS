import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import TasksPage from "./page";

const MOCK_TASKS_RICH = [
  {
    _id: "task-1",
    _creationTime: Date.now() - 5 * 86400000,
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo",
    title: "Implement SKU mapping logic",
    description:
      "Map Magento SKUs to Salesforce product codes using the transformation rules defined in FOUND-12.",
    status: "in_progress",
    priority: "high",
    assigneeName: "Sarah Chen",
    workstreamShortCode: "PDM",
    sprintName: "Sprint 3",
    dueDate: Date.now() + 7 * 86400000,
    hasSubtasks: true,
    subtaskCount: 4,
    subtasksCompleted: 2,
    subtasksFailed: 0,
    requirementRefId: "FOUND-12",
    requirementTitle: "Product SKU Mapping",
  },
  {
    _id: "task-2",
    _creationTime: Date.now() - 12 * 86400000,
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo",
    title: "Write category import script",
    description: "Build ETL pipeline to migrate category hierarchy from Magento to Salesforce B2B.",
    status: "done",
    priority: "high",
    assigneeName: "Alex Kim",
    workstreamShortCode: "PDM",
    sprintName: "Sprint 2",
    hasSubtasks: true,
    subtaskCount: 6,
    subtasksCompleted: 6,
    subtasksFailed: 0,
    requirementRefId: "FOUND-15",
    requirementTitle: "Category Hierarchy Migration",
  },
  {
    _id: "task-3",
    _creationTime: Date.now() - 3 * 86400000,
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo",
    title: "Set up order validation pipeline",
    description: "Validate historical order data integrity before migration.",
    status: "todo",
    priority: "medium",
    workstreamShortCode: "OHT",
    sprintName: "Sprint 3",
    dueDate: Date.now() + 14 * 86400000,
    hasSubtasks: false,
    requirementRefId: "FOUND-23",
    requirementTitle: "Order Data Validation Rules",
  },
  {
    _id: "task-4",
    _creationTime: Date.now() - 1 * 86400000,
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo",
    title: "Configure Salesforce API rate limiting",
    description:
      "Implement batch API calls with exponential backoff to stay within governor limits.",
    status: "backlog",
    priority: "critical",
    workstreamShortCode: "PDM",
    hasSubtasks: false,
  },
  {
    _id: "task-5",
    _creationTime: Date.now() - 8 * 86400000,
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo",
    title: "Build customer account sync service",
    description:
      "Synchronize customer accounts including addresses, payment terms, and pricing tiers.",
    status: "review",
    priority: "high",
    assigneeName: "Priya Nair",
    workstreamShortCode: "CA",
    sprintName: "Sprint 3",
    dueDate: Date.now() - 2 * 86400000,
    hasSubtasks: true,
    subtaskCount: 5,
    subtasksCompleted: 4,
    subtasksFailed: 1,
    requirementRefId: "FOUND-31",
    requirementTitle: "Customer Account Sync",
  },
  {
    _id: "task-6",
    _creationTime: Date.now() - 2 * 86400000,
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo",
    title: "Design B2B pricing tier engine",
    description:
      "Support contract pricing, volume discounts, and customer-specific catalog overrides.",
    status: "in_progress",
    priority: "critical",
    assigneeName: "Marcus Rivera",
    workstreamShortCode: "CA",
    sprintName: "Sprint 3",
    dueDate: Date.now() + 5 * 86400000,
    hasSubtasks: true,
    subtaskCount: 8,
    subtasksCompleted: 3,
    subtasksFailed: 0,
  },
  {
    _id: "task-7",
    _creationTime: Date.now(),
    orgId: "org_foundry_demo",
    programId: "prog-acme-demo",
    title: "Write integration tests for order pipeline",
    status: "backlog",
    priority: "low",
    workstreamShortCode: "OHT",
    hasSubtasks: false,
  },
];

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

const meta = {
  title: "Pages/Tasks/List",
  component: TasksPage,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    convexMockData: {
      "tasks:listByProgram": MOCK_TASKS_RICH,
      "workstreams:listByProgram": MOCK_WORKSTREAMS,
      "sprints:listByProgram": MOCK_SPRINTS,
    },
  },
} satisfies Meta<typeof TasksPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  parameters: {
    convexMockData: {
      "tasks:listByProgram": [],
      "workstreams:listByProgram": MOCK_WORKSTREAMS,
      "sprints:listByProgram": MOCK_SPRINTS,
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};
