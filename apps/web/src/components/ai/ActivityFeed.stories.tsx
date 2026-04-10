import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { ActivityFeed } from "./ActivityFeed";

const NOW = Date.now();

const mockExecutions = [
  {
    _id: "exec_001",
    _creationTime: NOW - 1000 * 60 * 5,
    taskType: "gap_analysis",
    skillName: "Requirements Analyzer",
    trigger: "manual",
    inputSummary:
      "Analyze the Magento B2B commerce migration requirements for gaps in data model coverage.",
    outputSummary: "Found 3 critical gaps in pricing logic and 2 in customer hierarchy mapping.",
    tokensUsed: 4821,
    durationMs: 12340,
    reviewStatus: "pending" as const,
  },
  {
    _id: "exec_002",
    _creationTime: NOW - 1000 * 60 * 60 * 2,
    taskType: "code_review",
    skillName: "Code Quality Auditor",
    trigger: "scheduled",
    inputSummary:
      "Review the Salesforce B2B Commerce connector integration code for quality and edge cases.",
    outputSummary: "Identified 5 potential null pointer exceptions and 2 missing error handlers.",
    tokensUsed: 7230,
    durationMs: 18900,
    reviewStatus: "accepted" as const,
  },
  {
    _id: "exec_003",
    _creationTime: NOW - 1000 * 60 * 60 * 24,
    taskType: "implementation",
    skillName: "Migration Planner",
    trigger: "manual",
    inputSummary:
      "Generate step-by-step implementation plan for customer account migration workstream.",
    outputSummary: null,
    tokensUsed: 9104,
    durationMs: 24500,
    reviewStatus: "revised" as const,
  },
  {
    _id: "exec_004",
    _creationTime: NOW - 1000 * 60 * 60 * 48,
    taskType: "risk_evaluation",
    skillName: null,
    trigger: "webhook",
    inputSummary: "Evaluate risks introduced by the new catalog sync architecture decision.",
    outputSummary: "High risk identified in real-time sync latency under peak load.",
    tokensUsed: 3200,
    durationMs: 8100,
    reviewStatus: "rejected" as const,
  },
];

const meta: Meta<typeof ActivityFeed> = {
  title: "AI/ActivityFeed",
  component: ActivityFeed,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    executions: { control: false },
    limit: { control: { type: "number", min: 1, max: 20 } },
    showPurpleAccent: { control: "boolean" },
    onSelect: { action: "selected" },
  },
};

export default meta;
type Story = StoryObj<typeof ActivityFeed>;

export const Default: Story = {
  args: {
    executions: mockExecutions,
    onSelect: fn(),
  },
};

export const WithAccentBorder: Story = {
  args: {
    executions: mockExecutions,
    showPurpleAccent: true,
    onSelect: fn(),
  },
};

export const Limited: Story = {
  args: {
    executions: mockExecutions,
    limit: 2,
    onSelect: fn(),
  },
};

export const SinglePending: Story = {
  args: {
    executions: [mockExecutions[0]],
    onSelect: fn(),
  },
};

export const AllStatuses: Story = {
  name: "All Review Statuses",
  args: {
    executions: mockExecutions,
    onSelect: fn(),
  },
};

export const Empty: Story = {
  args: {
    executions: [],
    onSelect: fn(),
  },
};

export const NoInteraction: Story = {
  args: {
    executions: mockExecutions,
  },
};

export const MinimalMetadata: Story = {
  args: {
    executions: [
      {
        _id: "exec_minimal",
        _creationTime: NOW - 1000 * 60 * 10,
        taskType: "analysis",
        skillName: null,
        trigger: "manual",
        inputSummary: null,
        outputSummary: null,
        tokensUsed: null,
        durationMs: null,
        reviewStatus: "pending" as const,
      },
    ],
    onSelect: fn(),
  },
};

export const Mobile: Story = {
  args: {
    executions: mockExecutions,
    onSelect: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    executions: mockExecutions,
    onSelect: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
