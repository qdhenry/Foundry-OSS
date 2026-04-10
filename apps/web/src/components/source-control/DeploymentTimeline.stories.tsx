import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DeploymentTimeline } from "./DeploymentTimeline";

const NOW = Date.now();
const mins = (n: number) => NOW - n * 60_000;
const hours = (n: number) => NOW - n * 3_600_000;
const days = (n: number) => NOW - n * 86_400_000;

const MOCK_DEPLOYMENTS = [
  {
    _id: "dep_1",
    environment: "production",
    status: "success",
    sha: "a1b2c3d4e5f6789012345678901234567890abcd",
    ref: "main",
    deployedBy: "github-actions[bot]",
    workflowName: "Deploy Production",
    deployedAt: hours(2),
    durationMs: 4 * 60_000 + 23_000,
  },
  {
    _id: "dep_2",
    environment: "staging",
    status: "success",
    sha: "a1b2c3d4e5f6789012345678901234567890abcd",
    ref: "main",
    deployedBy: "github-actions[bot]",
    workflowName: "Deploy Staging",
    deployedAt: hours(3),
    durationMs: 2 * 60_000 + 47_000,
  },
  {
    _id: "dep_3",
    environment: "staging",
    status: "failure",
    sha: "b2c3d4e5f6789012345678901234567890abcde",
    ref: "feature/checkout-flow",
    deployedBy: "alice-dev",
    workflowName: "Deploy Staging",
    deployedAt: hours(5),
    durationMs: 1 * 60_000 + 12_000,
  },
  {
    _id: "dep_4",
    environment: "development",
    status: "success",
    sha: "c3d4e5f6789012345678901234567890abcdef0",
    ref: "feature/checkout-flow",
    deployedBy: "alice-dev",
    workflowName: "Deploy Dev",
    deployedAt: hours(6),
    durationMs: 90_000,
  },
  {
    _id: "dep_5",
    environment: "development",
    status: "in_progress",
    sha: "d4e5f6789012345678901234567890abcdef01",
    ref: "feature/order-api",
    deployedBy: "bob-reviewer",
    workflowName: "Deploy Dev",
    deployedAt: mins(5),
    durationMs: null,
  },
  {
    _id: "dep_6",
    environment: "qa",
    status: "pending",
    sha: "e5f6789012345678901234567890abcdef0123",
    ref: "main",
    deployedBy: null,
    workflowName: "Deploy QA",
    deployedAt: days(1),
    durationMs: null,
  },
];

const PRODUCTION_ONLY = MOCK_DEPLOYMENTS.filter((d) => d.environment === "production");

const meta: Meta<typeof DeploymentTimeline> = {
  title: "SourceControl/DeploymentTimeline",
  component: DeploymentTimeline,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    programId: "prog_acme_corp" as any,
  },
};

export default meta;
type Story = StoryObj<typeof DeploymentTimeline>;

export const AllEnvironments: Story = {
  parameters: {
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": MOCK_DEPLOYMENTS,
    },
  },
};

export const ProductionOnly: Story = {
  args: {
    environment: "production",
  },
  parameters: {
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": PRODUCTION_ONLY,
    },
  },
};

export const WithInProgress: Story = {
  parameters: {
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": [
        MOCK_DEPLOYMENTS[4],
        ...MOCK_DEPLOYMENTS.slice(0, 3),
      ],
    },
  },
};

export const SingleDeployment: Story = {
  parameters: {
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": [MOCK_DEPLOYMENTS[0]],
    },
  },
};

export const EmptyState: Story = {
  parameters: {
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": [],
    },
  },
};

export const LoadingState: Story = {
  parameters: {
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": undefined,
    },
  },
};

export const Mobile: Story = {
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": MOCK_DEPLOYMENTS,
    },
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: { defaultViewport: "tablet" },
    convex: {
      "sourceControl.deployments.deploymentTracking.listByProgram": MOCK_DEPLOYMENTS,
    },
  },
};
