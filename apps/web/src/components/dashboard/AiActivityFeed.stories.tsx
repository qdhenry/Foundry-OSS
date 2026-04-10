import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AiActivityFeed } from "./AiActivityFeed";

const NOW = Date.now();
const minutesAgo = (m: number) => NOW - m * 60 * 1000;
const hoursAgo = (h: number) => NOW - h * 60 * 60 * 1000;
const daysAgo = (d: number) => NOW - d * 24 * 60 * 60 * 1000;

const mockExecutions = [
  {
    _id: "exec_001",
    _creationTime: minutesAgo(3),
    skillName: "Salesforce B2B Commerce Data Model",
    taskType: "schema_generation",
    status: "completed",
  },
  {
    _id: "exec_002",
    _creationTime: minutesAgo(12),
    skillName: "Magento Product Catalog Migration",
    taskType: "data_migration",
    status: "running",
  },
  {
    _id: "exec_003",
    _creationTime: hoursAgo(1),
    skillName: "BigCommerce B2B Price List Sync",
    taskType: "integration",
    status: "pending_review",
  },
  {
    _id: "exec_004",
    _creationTime: hoursAgo(4),
    skillName: "Customer Account Hierarchy Mapping",
    taskType: "analysis",
    status: "completed",
  },
  {
    _id: "exec_005",
    _creationTime: daysAgo(1),
    skillName: "Order History Import Validation",
    taskType: "validation",
    status: "failed",
  },
];

const meta: Meta<typeof AiActivityFeed> = {
  title: "Dashboard/AiActivityFeed",
  component: AiActivityFeed,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    executions: {
      description: "List of agent execution records to display in the feed",
    },
  },
};

export default meta;
type Story = StoryObj<typeof AiActivityFeed>;

export const Default: Story = {
  args: {
    executions: mockExecutions,
  },
};

export const AllCompleted: Story = {
  args: {
    executions: mockExecutions.map((e) => ({
      ...e,
      status: "completed",
    })),
  },
};

export const AllRunning: Story = {
  args: {
    executions: [
      {
        _id: "exec_run_001",
        _creationTime: minutesAgo(1),
        skillName: "Salesforce Commerce Cloud API Integration",
        taskType: "integration",
        status: "running",
      },
      {
        _id: "exec_run_002",
        _creationTime: minutesAgo(5),
        skillName: "BigCommerce Catalog Indexing",
        taskType: "indexing",
        status: "running",
      },
    ],
  },
};

export const WithPendingReview: Story = {
  args: {
    executions: [
      {
        _id: "exec_pr_001",
        _creationTime: minutesAgo(8),
        skillName: "Checkout Flow Redesign",
        taskType: "ui_generation",
        status: "pending_review",
      },
      {
        _id: "exec_pr_002",
        _creationTime: minutesAgo(45),
        skillName: "Account Role Permission Matrix",
        taskType: "access_control",
        status: "pending_review",
      },
      {
        _id: "exec_pr_003",
        _creationTime: hoursAgo(2),
        skillName: "Custom Pricing Rule Engine",
        taskType: "business_logic",
        status: "pending_review",
      },
    ],
  },
};

export const WithFailures: Story = {
  args: {
    executions: [
      {
        _id: "exec_fail_001",
        _creationTime: minutesAgo(20),
        skillName: "Legacy API Endpoint Migration",
        taskType: "migration",
        status: "failed",
      },
      {
        _id: "exec_fail_002",
        _creationTime: hoursAgo(3),
        skillName: "Magento Order Sync",
        taskType: "sync",
        status: "failed",
      },
      {
        _id: "exec_002",
        _creationTime: minutesAgo(5),
        skillName: "Salesforce Contact Import",
        taskType: "import",
        status: "running",
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    executions: [],
  },
};

export const SingleItem: Story = {
  args: {
    executions: [
      {
        _id: "exec_single_001",
        _creationTime: minutesAgo(2),
        skillName: "AcmeCorp Platform Assessment",
        taskType: "analysis",
        status: "completed",
      },
    ],
  },
};

export const WithoutTaskTypes: Story = {
  name: "Without Task Types",
  args: {
    executions: mockExecutions.map(({ taskType: _taskType, ...rest }) => rest),
  },
};

export const LongList: Story = {
  name: "Long List (10 items)",
  args: {
    executions: [
      ...mockExecutions,
      {
        _id: "exec_006",
        _creationTime: daysAgo(1),
        skillName: "Inventory Management API",
        taskType: "api_scaffold",
        status: "completed",
      },
      {
        _id: "exec_007",
        _creationTime: daysAgo(2),
        skillName: "B2B Quote Request Workflow",
        taskType: "workflow",
        status: "completed",
      },
      {
        _id: "exec_008",
        _creationTime: daysAgo(2),
        skillName: "Tax Calculation Service Integration",
        taskType: "integration",
        status: "pending_review",
      },
      {
        _id: "exec_009",
        _creationTime: daysAgo(3),
        skillName: "Storefront Theme Migration",
        taskType: "ui_migration",
        status: "completed",
      },
      {
        _id: "exec_010",
        _creationTime: daysAgo(4),
        skillName: "Customer Segmentation Rules",
        taskType: "business_logic",
        status: "failed",
      },
    ],
  },
};

export const Mobile: Story = {
  args: {
    executions: mockExecutions.slice(0, 3),
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const Tablet: Story = {
  args: {
    executions: mockExecutions,
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
