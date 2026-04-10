import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { setMockOverrides } from "../../../.storybook/mocks/convex";
import { SandboxLogStream } from "./SandboxLogStream";

// ---------------------------------------------------------------------------
// Mock sessions
// ---------------------------------------------------------------------------

const SESSION_READY = {
  _id: "sess-log-1",
  status: "ready",
  setupProgress: null,
  runtimeMode: "idle",
  repositoryId: "repo-1",
  taskPrompt: "Implement checkout validation",
  prUrl: null,
  worktreeBranch: "foundry/task-checkout-validation",
  commitSha: null,
  filesChanged: null,
  error: null,
};

const SESSION_EXECUTING = {
  ...SESSION_READY,
  status: "executing",
  runtimeMode: "executing",
};

const SESSION_COMPLETED = {
  _id: "sess-log-2",
  status: "completed",
  setupProgress: null,
  runtimeMode: null,
  repositoryId: "repo-1",
  taskPrompt: "Add form validation",
  prUrl: "https://github.com/org/repo/pull/42",
  worktreeBranch: "foundry/task-add-form-validation",
  commitSha: "a1b2c3d4e5f6",
  filesChanged: 4,
  error: null,
};

const SESSION_FAILED = {
  _id: "sess-log-3",
  status: "failed",
  setupProgress: null,
  runtimeMode: null,
  repositoryId: "repo-1",
  taskPrompt: "Refactor database layer",
  prUrl: null,
  worktreeBranch: "foundry/task-refactor-db",
  commitSha: null,
  filesChanged: null,
  error: "Build failed: Module not found '@/lib/db'. Ensure all imports resolve correctly.",
};

const SESSION_PROVISIONING = {
  _id: "sess-log-4",
  status: "provisioning",
  setupProgress: {
    stage: "gitClone",
    completedStages: ["containerProvision", "systemSetup", "authSetup"],
    totalStages: 10,
  },
  runtimeMode: null,
  repositoryId: "repo-1",
  taskPrompt: "Build new API endpoint",
  prUrl: null,
  worktreeBranch: null,
  commitSha: null,
  filesChanged: null,
  error: null,
};

// ---------------------------------------------------------------------------
// Mock log entries
// ---------------------------------------------------------------------------

const now = Date.now();

const LOGS_EMPTY: never[] = [];

const LOGS_SETUP = [
  { _id: "log-1", timestamp: now - 30000, level: "system", message: "Container provisioned" },
  { _id: "log-2", timestamp: now - 25000, level: "system", message: "System setup complete" },
  { _id: "log-3", timestamp: now - 20000, level: "system", message: "Auth configured" },
  { _id: "log-4", timestamp: now - 15000, level: "system", message: "Claude config applied" },
  { _id: "log-5", timestamp: now - 10000, level: "system", message: "Cloning repository..." },
  { _id: "log-6", timestamp: now - 5000, level: "stdout", message: "Cloning into '/workspace'..." },
  {
    _id: "log-7",
    timestamp: now - 3000,
    level: "stdout",
    message: "remote: Enumerating objects: 1842, done.",
  },
  {
    _id: "log-8",
    timestamp: now - 1000,
    level: "system",
    message: "Repository cloned successfully",
  },
];

const LOGS_EXECUTING = [
  ...LOGS_SETUP,
  { _id: "log-9", timestamp: now - 500, level: "system", message: "Agent started" },
  { _id: "log-10", timestamp: now - 400, level: "stdout", message: "Reading task context..." },
  {
    _id: "log-11",
    timestamp: now - 300,
    level: "stdout",
    message: "Analyzing existing codebase...",
  },
  {
    _id: "log-12",
    timestamp: now - 200,
    level: "info",
    message: "CheckoutForm.tsx",
    metadata: { fileChange: { type: "A", path: "src/components/checkout/CheckoutForm.tsx" } },
  },
  {
    _id: "log-13",
    timestamp: now - 100,
    level: "info",
    message: "validation.ts",
    metadata: { fileChange: { type: "A", path: "src/lib/checkout/validation.ts" } },
  },
];

const LOGS_COMPLETED = [
  ...LOGS_EXECUTING,
  {
    _id: "log-final",
    timestamp: now,
    level: "system",
    message: "Execution complete",
    metadata: {
      fileChangeSummary: {
        files: [
          { status: "A", path: "src/components/checkout/CheckoutForm.tsx" },
          { status: "A", path: "src/lib/checkout/validation.ts" },
          { status: "M", path: "src/app/(dashboard)/checkout/page.tsx" },
          { status: "M", path: "convex/tasks.ts" },
        ],
        diffs: {},
        totalFiles: 4,
      },
    },
  },
];

const LOGS_WITH_ERRORS = [
  { _id: "log-1", timestamp: now - 10000, level: "system", message: "Starting build..." },
  { _id: "log-2", timestamp: now - 8000, level: "stdout", message: "npm run build" },
  {
    _id: "log-3",
    timestamp: now - 6000,
    level: "stderr",
    message: "ERROR: Module not found '@/lib/db'",
  },
  {
    _id: "log-4",
    timestamp: now - 4000,
    level: "stderr",
    message: "  at Object.<anonymous> (convex/tasks.ts:3:1)",
  },
  {
    _id: "log-5",
    timestamp: now - 2000,
    level: "system",
    message: "Build failed with exit code 1",
  },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SandboxLogStream> = {
  title: "Sandbox/SandboxLogStream",
  component: SandboxLogStream,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof SandboxLogStream>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Executing — live logs",
  args: { sessionId: "sess-log-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_EXECUTING,
        "logs:listBySession": LOGS_EXECUTING,
      });
      return <Story />;
    },
  ],
};

export const Waiting: Story = {
  name: "Waiting — no logs yet",
  args: { sessionId: "sess-log-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_READY,
        "logs:listBySession": LOGS_EMPTY,
      });
      return <Story />;
    },
  ],
};

export const Provisioning: Story = {
  name: "Provisioning — setup in progress",
  args: { sessionId: "sess-log-4" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_PROVISIONING,
        "logs:listBySession": LOGS_SETUP,
      });
      return <Story />;
    },
  ],
};

export const Completed: Story = {
  name: "Completed — with file summary",
  args: { sessionId: "sess-log-2" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_COMPLETED,
        "logs:listBySession": LOGS_COMPLETED,
      });
      return <Story />;
    },
  ],
};

export const Failed: Story = {
  name: "Failed — with error message",
  args: {
    sessionId: "sess-log-3",
    onRestart: () => {},
    onRestartNow: () => {},
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_FAILED,
        "logs:listBySession": LOGS_WITH_ERRORS,
      });
      return <Story />;
    },
  ],
};

export const FailedRestarting: Story = {
  name: "Failed — restart in progress",
  args: {
    sessionId: "sess-log-3",
    onRestart: () => {},
    onRestartNow: () => {},
    isRestartingNow: true,
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_FAILED,
        "logs:listBySession": LOGS_WITH_ERRORS,
      });
      return <Story />;
    },
  ],
};

export const FailedWithRestartError: Story = {
  name: "Failed — restart error",
  args: {
    sessionId: "sess-log-3",
    onRestart: () => {},
    onRestartNow: () => {},
    restartNowError: "Repository context is missing. Cannot restart this session.",
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_FAILED,
        "logs:listBySession": LOGS_WITH_ERRORS,
      });
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  name: "Loading — connecting to stream",
  args: { sessionId: "sess-log-1" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_EXECUTING,
        "logs:listBySession": undefined,
      });
      return <Story />;
    },
  ],
};

export const WithStderrErrors: Story = {
  name: "Stderr output visible",
  args: { sessionId: "sess-log-3" },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_FAILED,
        "logs:listBySession": LOGS_WITH_ERRORS,
      });
      return <Story />;
    },
  ],
};

export const Mobile: Story = {
  name: "Mobile viewport",
  args: { sessionId: "sess-log-1" },
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_EXECUTING,
        "logs:listBySession": LOGS_EXECUTING,
      });
      return <Story />;
    },
  ],
};

export const Tablet: Story = {
  name: "Tablet viewport",
  args: { sessionId: "sess-log-1" },
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "sessions:get": SESSION_COMPLETED,
        "logs:listBySession": LOGS_COMPLETED,
      });
      return <Story />;
    },
  ],
};
