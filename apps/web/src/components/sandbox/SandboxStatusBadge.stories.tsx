import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SandboxStatusBadge } from "./SandboxStatusBadge";

// Helper to build a realistic setupProgress object
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

const PROGRESS_PARTIAL = makeProgress({
  containerProvision: "completed",
  systemSetup: "completed",
  authSetup: "completed",
  claudeConfig: "running",
  gitClone: "pending",
  depsInstall: "pending",
  mcpInstall: "pending",
  workspaceCustomization: "pending",
  healthCheck: "pending",
  ready: "pending",
});

const PROGRESS_COMPLETE = makeProgress({
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

const PROGRESS_FAILED = makeProgress({
  containerProvision: "completed",
  systemSetup: "failed",
  authSetup: "pending",
  claudeConfig: "pending",
  gitClone: "pending",
  depsInstall: "pending",
  mcpInstall: "pending",
  workspaceCustomization: "pending",
  healthCheck: "pending",
  ready: "pending",
});

const meta = {
  title: "Sandbox/SandboxStatusBadge",
  component: SandboxStatusBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    status: {
      description: "Current sandbox lifecycle status",
      control: { type: "select" },
      options: [
        "provisioning",
        "cloning",
        "executing",
        "finalizing",
        "completed",
        "failed",
        "cancelled",
        "sleeping",
        "ready",
        "custom_status",
      ],
    },
    prUrl: {
      description: "PR URL shown as a link when status is 'completed'",
      control: { type: "text" },
    },
    runtimeMode: {
      description: "Optional runtime mode badge shown alongside the status",
      control: { type: "select" },
      options: [null, "idle", "executing", "interactive", "hibernating"],
    },
    showSetupProgress: {
      description: "Whether to show the setup stage counter inside the badge",
      control: { type: "boolean" },
    },
    className: {
      description: "Additional CSS classes",
      control: { type: "text" },
    },
  },
} satisfies Meta<typeof SandboxStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Core status variants

export const Default: Story = {
  name: "Provisioning",
  args: {
    status: "provisioning",
    setupProgress: PROGRESS_PARTIAL,
    showSetupProgress: true,
  },
};

export const Cloning: Story = {
  args: {
    status: "cloning",
    setupProgress: PROGRESS_PARTIAL,
    showSetupProgress: true,
  },
};

export const Executing: Story = {
  args: {
    status: "executing",
    runtimeMode: "executing",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
};

export const Finalizing: Story = {
  args: {
    status: "finalizing",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: true,
  },
};

export const Completed: Story = {
  args: {
    status: "completed",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
};

export const CompletedWithPR: Story = {
  name: "Completed with PR Link",
  args: {
    status: "completed",
    prUrl: "https://github.com/org/repo/pull/42",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
};

export const Failed: Story = {
  args: {
    status: "failed",
    setupProgress: PROGRESS_FAILED,
    showSetupProgress: true,
  },
};

export const Cancelled: Story = {
  args: {
    status: "cancelled",
  },
};

export const Sleeping: Story = {
  args: {
    status: "sleeping",
  },
};

export const Ready: Story = {
  args: {
    status: "ready",
    runtimeMode: "interactive",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
};

// Runtime mode combinations
export const ExecutingWithIdleRuntime: Story = {
  name: "Executing + Idle Runtime Mode",
  args: {
    status: "executing",
    runtimeMode: "idle",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
};

export const ReadyWithInteractiveRuntime: Story = {
  name: "Ready + Interactive Runtime",
  args: {
    status: "ready",
    runtimeMode: "interactive",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
};

export const ReadyWithHibernatingRuntime: Story = {
  name: "Ready + Hibernating Runtime",
  args: {
    status: "ready",
    runtimeMode: "hibernating",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
};

// Unknown / custom status
export const CustomStatus: Story = {
  name: "Custom / Unknown Status",
  args: {
    status: "custom_status",
  },
};

// All status variants in a grid — uses explicit args to satisfy Story typing
export const AllStatuses: Story = {
  name: "All Statuses",
  args: { status: "provisioning" },
  render: (_args) => (
    <div className="flex flex-col gap-3 p-4">
      {(
        [
          "provisioning",
          "cloning",
          "executing",
          "finalizing",
          "completed",
          "failed",
          "cancelled",
          "sleeping",
          "ready",
        ] as const
      ).map((status) => (
        <div key={status} className="flex items-center gap-4">
          <span className="w-32 text-xs text-text-muted">{status}</span>
          <SandboxStatusBadge status={status} />
        </div>
      ))}
    </div>
  ),
};

// Setup progress counter visible
export const WithSetupProgressCounter: Story = {
  name: "With Setup Progress Counter",
  args: {
    status: "provisioning",
    setupProgress: PROGRESS_PARTIAL,
    showSetupProgress: true,
  },
};

// Setup progress hidden
export const WithoutSetupProgressCounter: Story = {
  name: "Without Setup Progress Counter",
  args: {
    status: "provisioning",
    setupProgress: PROGRESS_PARTIAL,
    showSetupProgress: false,
  },
};

export const Mobile: Story = {
  args: {
    status: "executing",
    runtimeMode: "executing",
    setupProgress: PROGRESS_COMPLETE,
    showSetupProgress: false,
  },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
};

export const Tablet: Story = {
  args: {
    status: "provisioning",
    setupProgress: PROGRESS_PARTIAL,
    showSetupProgress: true,
  },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
};
