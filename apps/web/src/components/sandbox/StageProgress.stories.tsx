import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StageProgress } from "./StageProgress";

// Helper: build a setupProgress object with specific statuses per stage
type StageStatus = "pending" | "running" | "completed" | "failed" | "skipped";

function makeProgress(
  stages: Partial<
    Record<
      | "containerProvision"
      | "systemSetup"
      | "authSetup"
      | "claudeConfig"
      | "gitClone"
      | "depsInstall"
      | "mcpInstall"
      | "workspaceCustomization"
      | "healthCheck"
      | "ready",
      StageStatus
    >
  >,
): Record<string, { status: StageStatus }> {
  return Object.fromEntries(Object.entries(stages).map(([key, status]) => [key, { status }]));
}

const EARLY_PROGRESS = makeProgress({
  containerProvision: "completed",
  systemSetup: "running",
  authSetup: "pending",
  claudeConfig: "pending",
  gitClone: "pending",
  depsInstall: "pending",
  mcpInstall: "pending",
  workspaceCustomization: "pending",
  healthCheck: "pending",
  ready: "pending",
});

const MID_PROGRESS = makeProgress({
  containerProvision: "completed",
  systemSetup: "completed",
  authSetup: "completed",
  claudeConfig: "completed",
  gitClone: "completed",
  depsInstall: "running",
  mcpInstall: "pending",
  workspaceCustomization: "pending",
  healthCheck: "pending",
  ready: "pending",
});

const ALMOST_DONE = makeProgress({
  containerProvision: "completed",
  systemSetup: "completed",
  authSetup: "completed",
  claudeConfig: "completed",
  gitClone: "completed",
  depsInstall: "completed",
  mcpInstall: "completed",
  workspaceCustomization: "completed",
  healthCheck: "running",
  ready: "pending",
});

const COMPLETED = makeProgress({
  containerProvision: "completed",
  systemSetup: "completed",
  authSetup: "completed",
  claudeConfig: "completed",
  gitClone: "completed",
  depsInstall: "completed",
  mcpInstall: "completed",
  workspaceCustomization: "completed",
  healthCheck: "completed",
  ready: "completed",
});

const FAILED = makeProgress({
  containerProvision: "completed",
  systemSetup: "completed",
  authSetup: "completed",
  claudeConfig: "failed",
  gitClone: "pending",
  depsInstall: "pending",
  mcpInstall: "pending",
  workspaceCustomization: "pending",
  healthCheck: "pending",
  ready: "pending",
});

const WITH_SKIPPED = makeProgress({
  containerProvision: "completed",
  systemSetup: "completed",
  authSetup: "skipped",
  claudeConfig: "completed",
  gitClone: "completed",
  depsInstall: "completed",
  mcpInstall: "skipped",
  workspaceCustomization: "completed",
  healthCheck: "completed",
  ready: "completed",
});

const meta = {
  title: "Sandbox/StageProgress",
  component: StageProgress,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    setupProgress: {
      description: "Raw setupProgress object keyed by stage name with a status field each",
      control: false,
    },
    compact: {
      description: "Render inline compact variant instead of the card view",
      control: { type: "boolean" },
    },
    className: {
      description: "Additional CSS classes",
      control: { type: "text" },
    },
  },
} satisfies Meta<typeof StageProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Running — Early Stage",
  args: {
    setupProgress: EARLY_PROGRESS,
    compact: false,
  },
};

export const MidProgress: Story = {
  name: "Running — Mid Progress",
  args: {
    setupProgress: MID_PROGRESS,
    compact: false,
  },
};

export const AlmostDone: Story = {
  name: "Running — Almost Done",
  args: {
    setupProgress: ALMOST_DONE,
    compact: false,
  },
};

export const Completed: Story = {
  name: "Completed",
  args: {
    setupProgress: COMPLETED,
    compact: false,
  },
};

export const Failed: Story = {
  name: "Failed — Claude Config",
  args: {
    setupProgress: FAILED,
    compact: false,
  },
};

export const WithSkippedStages: Story = {
  name: "Completed with Skipped Stages",
  args: {
    setupProgress: WITH_SKIPPED,
    compact: false,
  },
};

export const NoData: Story = {
  name: "No Data (renders nothing)",
  args: {
    setupProgress: undefined,
    compact: false,
  },
};

// Compact variants
export const CompactRunning: Story = {
  name: "Compact — Running",
  args: {
    setupProgress: MID_PROGRESS,
    compact: true,
  },
};

export const CompactCompleted: Story = {
  name: "Compact — Completed",
  args: {
    setupProgress: COMPLETED,
    compact: true,
  },
};

export const CompactFailed: Story = {
  name: "Compact — Failed",
  args: {
    setupProgress: FAILED,
    compact: true,
  },
};

export const Mobile: Story = {
  args: {
    setupProgress: MID_PROGRESS,
    compact: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  args: {
    setupProgress: ALMOST_DONE,
    compact: false,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
