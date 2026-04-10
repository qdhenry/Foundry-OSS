import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CodeEvidenceSection } from "./CodeEvidenceSection";

const meta: Meta<typeof CodeEvidenceSection> = {
  title: "SourceControl/CodeEvidenceSection",
  component: CodeEvidenceSection,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    gateId: "gate_abc123" as any,
    sprintId: "sprint_xyz789" as any,
    programId: "prog_123" as any,
  },
};

export default meta;
type Story = StoryObj<typeof CodeEvidenceSection>;

const HEALTHY_EVIDENCE = {
  totalPRs: 12,
  mergedPRs: 10,
  openPRs: 2,
  prMergeCompletionPct: 83,
  ciBranchStatus: "passing",
  reviewCoveragePct: 92,
  reviewedPRCount: 11,
  unresolvedReviewComments: 0,
  forcePushCount: 0,
  hasHighRiskRequirements: false,
  deploymentStatus: [
    {
      environment: "development",
      status: "success",
      deployedAt: Date.now() - 3_600_000,
      sha: "a1b2c3d",
    },
    {
      environment: "staging",
      status: "success",
      deployedAt: Date.now() - 7_200_000,
      sha: "a1b2c3d",
    },
    { environment: "production", status: "inactive", deployedAt: null, sha: null },
  ],
};

const FAILING_EVIDENCE = {
  totalPRs: 8,
  mergedPRs: 3,
  openPRs: 5,
  prMergeCompletionPct: 37,
  ciBranchStatus: "failing",
  reviewCoveragePct: 38,
  reviewedPRCount: 3,
  unresolvedReviewComments: 7,
  forcePushCount: 2,
  hasHighRiskRequirements: true,
  deploymentStatus: [
    {
      environment: "development",
      status: "failure",
      deployedAt: Date.now() - 1_800_000,
      sha: "dead000",
    },
    { environment: "staging", status: "pending", deployedAt: null, sha: null },
    { environment: "production", status: "inactive", deployedAt: null, sha: null },
  ],
};

const PARTIAL_EVIDENCE = {
  totalPRs: 6,
  mergedPRs: 4,
  openPRs: 2,
  prMergeCompletionPct: 67,
  ciBranchStatus: "pending",
  reviewCoveragePct: 50,
  reviewedPRCount: 3,
  unresolvedReviewComments: 2,
  forcePushCount: 0,
  hasHighRiskRequirements: false,
  deploymentStatus: [
    { environment: "development", status: "in_progress", deployedAt: null, sha: "f3e2d1c" },
    { environment: "staging", status: "inactive", deployedAt: null, sha: null },
    { environment: "production", status: "inactive", deployedAt: null, sha: null },
  ],
};

const EMPTY_EVIDENCE = {
  totalPRs: 0,
  mergedPRs: 0,
  openPRs: 0,
  prMergeCompletionPct: 0,
  ciBranchStatus: "none",
  reviewCoveragePct: 0,
  reviewedPRCount: 0,
  unresolvedReviewComments: 0,
  forcePushCount: 0,
  hasHighRiskRequirements: false,
  deploymentStatus: [
    { environment: "development", status: "inactive", deployedAt: null, sha: null },
    { environment: "staging", status: "inactive", deployedAt: null, sha: null },
    { environment: "production", status: "inactive", deployedAt: null, sha: null },
  ],
};

export const Healthy: Story = {
  parameters: {
    convex: {
      "sourceControl.gates.codeEvidence.assembleCodeEvidence": HEALTHY_EVIDENCE,
    },
  },
};

export const Failing: Story = {
  parameters: {
    convex: {
      "sourceControl.gates.codeEvidence.assembleCodeEvidence": FAILING_EVIDENCE,
    },
  },
};

export const InProgress: Story = {
  parameters: {
    convex: {
      "sourceControl.gates.codeEvidence.assembleCodeEvidence": PARTIAL_EVIDENCE,
    },
  },
};

export const EmptyState: Story = {
  parameters: {
    convex: {
      "sourceControl.gates.codeEvidence.assembleCodeEvidence": EMPTY_EVIDENCE,
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.gates.codeEvidence.assembleCodeEvidence": undefined,
    },
  },
};

export const NoSprintLinked: Story = {
  args: {
    sprintId: undefined,
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.gates.codeEvidence.assembleCodeEvidence": HEALTHY_EVIDENCE,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.gates.codeEvidence.assembleCodeEvidence": FAILING_EVIDENCE,
    },
  },
};
