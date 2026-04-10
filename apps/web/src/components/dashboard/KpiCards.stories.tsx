import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { KpiCards } from "./KpiCards";

const meta: Meta<typeof KpiCards> = {
  title: "Dashboard/KpiCards",
  component: KpiCards,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    stats: {
      description: "Program-level aggregate statistics",
    },
    workstreamHealth: {
      description: "Workstream health breakdown counts",
    },
  },
};

export default meta;
type Story = StoryObj<typeof KpiCards>;

export const Default: Story = {
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 47,
      completionPercent: 40,
      workstreamCount: 7,
      riskCount: 5,
      agentExecutionCount: 34,
    },
    workstreamHealth: {
      onTrack: 4,
      atRisk: 2,
      blocked: 1,
    },
  },
};

export const HighCompletion: Story = {
  name: "High Completion (85%)",
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 100,
      completionPercent: 85,
      workstreamCount: 7,
      riskCount: 1,
      agentExecutionCount: 89,
    },
    workstreamHealth: {
      onTrack: 6,
      atRisk: 1,
      blocked: 0,
    },
  },
};

export const EarlyStage: Story = {
  name: "Early Stage (5%)",
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 6,
      completionPercent: 5,
      workstreamCount: 7,
      riskCount: 0,
      agentExecutionCount: 3,
    },
    workstreamHealth: {
      onTrack: 7,
      atRisk: 0,
      blocked: 0,
    },
  },
};

export const AtRisk: Story = {
  name: "At Risk Program",
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 30,
      completionPercent: 25,
      workstreamCount: 7,
      riskCount: 12,
      agentExecutionCount: 22,
    },
    workstreamHealth: {
      onTrack: 1,
      atRisk: 4,
      blocked: 2,
    },
  },
};

export const AllBlocked: Story = {
  name: "All Workstreams Blocked",
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 15,
      completionPercent: 13,
      workstreamCount: 7,
      riskCount: 18,
      agentExecutionCount: 8,
    },
    workstreamHealth: {
      onTrack: 0,
      atRisk: 0,
      blocked: 7,
    },
  },
};

export const FullyComplete: Story = {
  name: "Fully Complete (100%)",
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 118,
      completionPercent: 100,
      workstreamCount: 7,
      riskCount: 0,
      agentExecutionCount: 142,
    },
    workstreamHealth: {
      onTrack: 7,
      atRisk: 0,
      blocked: 0,
    },
  },
};

export const NoExecutions: Story = {
  name: "No Agent Executions Yet",
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 0,
      completionPercent: 0,
      workstreamCount: 7,
      riskCount: 0,
      agentExecutionCount: 0,
    },
    workstreamHealth: {
      onTrack: 7,
      atRisk: 0,
      blocked: 0,
    },
  },
};

export const SingleRisk: Story = {
  name: "Single Active Risk",
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 72,
      completionPercent: 61,
      workstreamCount: 7,
      riskCount: 1,
      agentExecutionCount: 55,
    },
    workstreamHealth: {
      onTrack: 5,
      atRisk: 1,
      blocked: 1,
    },
  },
};

export const Mobile: Story = {
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 47,
      completionPercent: 40,
      workstreamCount: 7,
      riskCount: 5,
      agentExecutionCount: 34,
    },
    workstreamHealth: {
      onTrack: 4,
      atRisk: 2,
      blocked: 1,
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};

export const Tablet: Story = {
  args: {
    stats: {
      totalRequirements: 118,
      completedRequirements: 47,
      completionPercent: 40,
      workstreamCount: 7,
      riskCount: 5,
      agentExecutionCount: 34,
    },
    workstreamHealth: {
      onTrack: 4,
      atRisk: 2,
      blocked: 1,
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
