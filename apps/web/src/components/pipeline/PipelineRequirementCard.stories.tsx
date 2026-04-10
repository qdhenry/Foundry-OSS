import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { PipelineRequirementCard } from "./PipelineRequirementCard";

const meta = {
  title: "Pipeline/PipelineRequirementCard",
  component: PipelineRequirementCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PipelineRequirementCard>;

export default meta;
type Story = StoryObj<typeof meta>;

const baseRequirement = {
  _id: "req_001",
  refId: "BM-001",
  title: "Customer Account Management — self-service portal for B2B buyers",
  priority: "must_have",
  fitGap: "custom_dev",
  pipelineStage: "implementation",
  sprintName: "Sprint 3 - Core Accounts",
  taskCount: 8,
  tasksCompleted: 5,
};

export const Default: Story = {
  args: {
    requirement: baseRequirement,
    onClick: fn(),
  },
};

export const Highlighted: Story = {
  args: {
    requirement: baseRequirement,
    onClick: fn(),
    isHighlighted: true,
  },
};

export const MustHavePriority: Story = {
  args: {
    requirement: { ...baseRequirement, priority: "must_have", fitGap: "native" },
    onClick: fn(),
  },
};

export const ShouldHavePriority: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      priority: "should_have",
      fitGap: "config",
      pipelineStage: "sprint_planning",
      sprintName: undefined,
    },
    onClick: fn(),
  },
};

export const NiceToHavePriority: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      refId: "BM-042",
      title: "Advanced reporting dashboard with custom filters",
      priority: "nice_to_have",
      fitGap: "third_party",
      pipelineStage: "requirement",
      sprintName: undefined,
      taskCount: 0,
      tasksCompleted: 0,
    },
    onClick: fn(),
  },
};

export const DeferredPriority: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      priority: "deferred",
      fitGap: "not_feasible",
      pipelineStage: "discovery",
      sprintName: undefined,
      taskCount: 0,
      tasksCompleted: 0,
    },
    onClick: fn(),
  },
};

export const RequirementStageNeedsApproval: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      pipelineStage: "requirement",
      sprintName: undefined,
      taskCount: 0,
      tasksCompleted: 0,
    },
    onClick: fn(),
  },
};

export const TaskGenerationNeedsTasks: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      pipelineStage: "task_generation",
      taskCount: 0,
      tasksCompleted: 0,
    },
    onClick: fn(),
  },
};

export const ReviewStage: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      pipelineStage: "review",
      taskCount: 8,
      tasksCompleted: 8,
    },
    onClick: fn(),
  },
};

export const NoSprintNoTasks: Story = {
  args: {
    requirement: {
      ...baseRequirement,
      sprintName: undefined,
      taskCount: 0,
      tasksCompleted: 0,
      pipelineStage: "discovery",
    },
    onClick: fn(),
  },
};

export const Mobile: Story = {
  args: {
    requirement: baseRequirement,
    onClick: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    requirement: baseRequirement,
    onClick: fn(),
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};

export const CardClick: Story = {
  args: {
    requirement: baseRequirement,
    onClick: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("button");
    await userEvent.click(card);
  },
};

export const KeyboardActivation: Story = {
  args: {
    requirement: baseRequirement,
    onClick: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole("button");
    card.focus();
    await userEvent.keyboard("{Enter}");
  },
};
