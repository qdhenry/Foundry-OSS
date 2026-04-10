import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PipelineStageContent } from "./PipelineStageContent";

const meta = {
  title: "Pipeline/PipelineStageContent",
  component: PipelineStageContent,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineStageContent>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseRequirement = {
  _id: "req_001",
  orgId: "org_acme",
  refId: "BM-001",
  title: "Customer Account Management — self-service portal for B2B buyers",
  description:
    "Buyers need to manage their own account details, order history, and payment methods without contacting support.",
  priority: "must_have",
  fitGap: "custom_dev",
  effortEstimate: "high",
  status: "approved",
  workstreamId: "ws_001",
};

const baseTasks = [
  {
    _id: "task_001",
    title: "Build account settings page",
    status: "in_progress",
    priority: "high",
    assigneeName: "Alice Chen",
    sprintName: "Sprint 3",
    hasSubtasks: true,
    subtaskCount: 4,
    subtasksCompleted: 2,
  },
  {
    _id: "task_002",
    title: "Implement order history API",
    status: "todo",
    priority: "high",
    assigneeName: "Bob Kim",
    sprintName: "Sprint 3",
    hasSubtasks: false,
    subtaskCount: 0,
    subtasksCompleted: 0,
  },
  {
    _id: "task_003",
    title: "Payment method management UI",
    status: "backlog",
    priority: "medium",
    sprintName: "Sprint 3",
    hasSubtasks: false,
    subtaskCount: 0,
    subtasksCompleted: 0,
  },
];

const mockFinding = {
  _id: "finding_001",
  status: "imported",
  type: "requirement",
  confidence: "high",
  sourceExcerpt:
    "Customers require self-service account management including profile updates and order visibility.",
  documentName: "AcmeCorp RFP v2.pdf",
  data: {
    description:
      "The system must allow B2B buyers to manage their account profile, view order history, and update payment methods.",
  },
};

const commonProps = {
  requirement: baseRequirement,
  programId: "prog_123" as any,
  workstreamId: "ws_001" as any,
  tasks: baseTasks,
};

export const DiscoveryWithFinding: Story = {
  args: {
    ...commonProps,
    stage: "discovery",
    finding: mockFinding,
  },
};

export const DiscoveryNoFinding: Story = {
  args: {
    ...commonProps,
    stage: "discovery",
    finding: null,
  },
};

export const Requirement: Story = {
  args: {
    ...commonProps,
    stage: "requirement",
    finding: null,
  },
};

export const SprintPlanning: Story = {
  args: {
    ...commonProps,
    stage: "sprint_planning",
    finding: null,
  },
};

export const TaskGeneration: Story = {
  args: {
    ...commonProps,
    stage: "task_generation",
    finding: null,
  },
};

export const SubtaskGeneration: Story = {
  args: {
    ...commonProps,
    stage: "subtask_generation",
    finding: null,
  },
};

export const Implementation: Story = {
  args: {
    ...commonProps,
    stage: "implementation",
    finding: null,
  },
};

export const Testing: Story = {
  args: {
    ...commonProps,
    tasks: baseTasks.map((t) => ({ ...t, status: "review" })),
    stage: "testing",
    finding: null,
  },
};

export const Review: Story = {
  args: {
    ...commonProps,
    tasks: baseTasks.map((t) => ({ ...t, status: "done" })),
    stage: "review",
    finding: null,
  },
};

export const Mobile: Story = {
  args: {
    ...commonProps,
    stage: "implementation",
    finding: null,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    ...commonProps,
    stage: "implementation",
    finding: null,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
