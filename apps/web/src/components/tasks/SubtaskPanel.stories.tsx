import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, userEvent, within } from "@storybook/test";
import { SubtaskPanel } from "./SubtaskPanel";

const meta: Meta<typeof SubtaskPanel> = {
  title: "Tasks/SubtaskPanel",
  component: SubtaskPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    onExecuteAll: fn(),
    onExecuteSelected: fn(),
    onExecuteSubtask: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof SubtaskPanel>;

// SubtaskPanel relies heavily on useQuery / useMutation from convex/react.
// Those hooks are globally mocked to return undefined (loading) by default.
// Stories below focus on the prop-driven shell and structural variants.

export const EmptyState: Story = {
  args: {
    taskId: "task_001" as any,
    task: {
      hasSubtasks: false,
      subtaskGenerationStatus: "idle",
    },
    isExecutionActive: false,
  },
};

export const GeneratingSubtasks: Story = {
  args: {
    taskId: "task_002" as any,
    task: {
      hasSubtasks: false,
      subtaskGenerationStatus: "processing",
    },
    isExecutionActive: false,
  },
};

export const GenerationError: Story = {
  args: {
    taskId: "task_003" as any,
    task: {
      hasSubtasks: false,
      subtaskGenerationStatus: "error",
      subtaskGenerationError:
        "Claude API timeout after 30s. The task context may be too large — try trimming the requirement description and retry.",
    },
    isExecutionActive: false,
  },
};

export const WithSubtasksIdle: Story = {
  args: {
    taskId: "task_004" as any,
    task: {
      hasSubtasks: true,
      subtaskGenerationStatus: "completed",
    },
    isExecutionActive: false,
  },
};

export const ExecutionActive: Story = {
  args: {
    taskId: "task_005" as any,
    task: {
      hasSubtasks: true,
      subtaskGenerationStatus: "completed",
    },
    isExecutionActive: true,
  },
};

export const NoExecutionCallbacks: Story = {
  name: "Read-only (no execution callbacks)",
  args: {
    taskId: "task_006" as any,
    task: {
      hasSubtasks: true,
      subtaskGenerationStatus: "completed",
    },
    onExecuteAll: undefined,
    onExecuteSelected: undefined,
    onExecuteSubtask: undefined,
    isExecutionActive: false,
  },
};

export const InteractiveExpandCollapse: Story = {
  args: {
    taskId: "task_007" as any,
    task: {
      hasSubtasks: false,
      subtaskGenerationStatus: "idle",
    },
    isExecutionActive: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Collapse the panel
    const header = canvas.getByRole("button", { name: /subtasks/i });
    await userEvent.click(header);
    // Re-expand
    await userEvent.click(header);
  },
};

export const InteractiveBreakDown: Story = {
  args: {
    taskId: "task_008" as any,
    task: {
      hasSubtasks: false,
      subtaskGenerationStatus: "idle",
    },
    isExecutionActive: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const breakDownBtn = canvas.getByRole("button", { name: /break down/i });
    await userEvent.click(breakDownBtn);
  },
};

export const Mobile: Story = {
  args: {
    taskId: "task_009" as any,
    task: {
      hasSubtasks: false,
      subtaskGenerationStatus: "idle",
    },
    isExecutionActive: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Tablet: Story = {
  args: {
    taskId: "task_010" as any,
    task: {
      hasSubtasks: true,
      subtaskGenerationStatus: "completed",
    },
    isExecutionActive: false,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
