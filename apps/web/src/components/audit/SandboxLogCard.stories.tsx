import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SandboxLogCard } from "./SandboxLogCard";

/**
 * SandboxLogCard uses useQuery(api.sandbox.logs.listByTask) internally.
 * The Convex mock (aliased via Vite) intercepts this and returns data keyed
 * by "logs:listByTask". We call setMockOverrides per-story to inject log data.
 *
 * The component renders null when logs === undefined || logs.length === 0,
 * so every story that needs visible output must supply a non-empty array.
 */

// ── Mock helpers ──────────────────────────────────────────────────────────────

type MockStore = { setMockOverrides: (o: Record<string, unknown>) => void };
const convexMock = (): MockStore =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../../.storybook/mocks/convex") as MockStore;

const NOW = Date.now();
const secondsAgo = (s: number) => NOW - s * 1000;

const infoLog = (message: string, offsetSecs = 0) => ({
  _id: `log-info-${offsetSecs}`,
  level: "info",
  message,
  timestamp: secondsAgo(offsetSecs),
  taskId: "task-1",
});

const stdoutLog = (message: string, offsetSecs = 0) => ({
  _id: `log-stdout-${offsetSecs}`,
  level: "stdout",
  message,
  timestamp: secondsAgo(offsetSecs),
  taskId: "task-1",
});

const stderrLog = (message: string, offsetSecs = 0) => ({
  _id: `log-stderr-${offsetSecs}`,
  level: "stderr",
  message,
  timestamp: secondsAgo(offsetSecs),
  taskId: "task-1",
});

const systemLog = (message: string, offsetSecs = 0) => ({
  _id: `log-system-${offsetSecs}`,
  level: "system",
  message,
  timestamp: secondsAgo(offsetSecs),
  taskId: "task-1",
});

const errorLog = (message: string, offsetSecs = 0) => ({
  _id: `log-error-${offsetSecs}`,
  level: "error",
  message,
  timestamp: secondsAgo(offsetSecs),
  taskId: "task-1",
});

const structuredStdout = JSON.stringify([
  {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          name: "Read",
          input: { file_path: "/workspace/src/products/sku-mapper.ts" },
        },
      ],
    },
  },
]);

const sessionInitLog = JSON.stringify({
  type: "system",
  subtype: "init",
  session_id: "sess_acme_001",
  claude_code_version: "1.2.3",
  tools: ["Read", "Write", "Bash", "Edit"],
});

const resultLog = JSON.stringify({
  type: "result",
  result: "Task completed successfully. Created SKU mapping module with 247 product entries.",
  duration_ms: 48200,
  cost_usd: 0.0312,
});

const mockLogs = [
  systemLog(sessionInitLog, 120),
  infoLog("Sandbox session started", 115),
  infoLog("Cloning repository: foundry-app/acme-corp", 110),
  infoLog("Repository cloned successfully", 100),
  infoLog("Installing dependencies...", 95),
  stdoutLog("npm install completed in 12.3s", 80),
  infoLog("Starting task execution: Implement SKU mapping logic", 75),
  stdoutLog(structuredStdout, 60),
  stdoutLog("Writing file: /workspace/src/products/sku-mapper.ts", 45),
  infoLog("File written: 247 lines", 40),
  stdoutLog(resultLog, 10),
  infoLog("Sandbox execution complete", 5),
];

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof SandboxLogCard> = {
  title: "Audit/SandboxLogCard",
  component: SandboxLogCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    taskId: {
      description: "The Convex task ID used to fetch sandbox logs via useQuery",
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SandboxLogCard>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "logs:listByTask": mockLogs });
      return <Story />;
    },
  ],
};

export const InfoLogsOnly: Story = {
  name: "Info Logs Only",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:listByTask": [
          infoLog("Sandbox session started", 60),
          infoLog("Cloning repository", 55),
          infoLog("Installing dependencies", 50),
          infoLog("Starting task execution", 45),
          infoLog("Task complete", 5),
        ],
      });
      return <Story />;
    },
  ],
};

export const WithErrors: Story = {
  name: "With Error Logs",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:listByTask": [
          infoLog("Sandbox session started", 90),
          infoLog("Cloning repository", 85),
          stdoutLog("npm install completed", 70),
          infoLog("Starting execution", 60),
          stderrLog("TypeError: Cannot read properties of undefined (reading 'sku')", 45),
          errorLog("Execution failed: unhandled exception in sku-mapper.ts line 42", 40),
          infoLog("Sandbox terminated with error", 35),
        ],
      });
      return <Story />;
    },
  ],
};

export const WithStructuredLogs: Story = {
  name: "With Structured stdout Logs",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:listByTask": [
          systemLog(sessionInitLog, 120),
          infoLog("Session initialized", 115),
          stdoutLog(structuredStdout, 60),
          stdoutLog(resultLog, 10),
          infoLog("Done", 5),
        ],
      });
      return <Story />;
    },
  ],
};

export const MixedLevels: Story = {
  name: "Mixed Log Levels",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:listByTask": [
          systemLog("Session started", 120),
          infoLog("Cloning repository", 110),
          stdoutLog("Cloned in 3.2s", 100),
          infoLog("Installing deps", 90),
          stderrLog("npm warn: deprecated package react-scripts@4.0.0", 80),
          stdoutLog("Install complete", 70),
          infoLog("Running task", 60),
          errorLog("Warning: memory usage above 80%", 40),
          stdoutLog("Task output: 42 records processed", 20),
          infoLog("Complete", 5),
        ],
      });
      return <Story />;
    },
  ],
};

export const SingleLog: Story = {
  name: "Single Log Entry",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:listByTask": [infoLog("Sandbox session started", 5)],
      });
      return <Story />;
    },
  ],
};

export const Mobile: Story = {
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "logs:listByTask": mockLogs.slice(0, 5) });
      return <Story />;
    },
  ],
  parameters: {
    viewport: {
      defaultViewport: "mobile",
    },
  },
};

export const Tablet: Story = {
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({ "logs:listByTask": mockLogs });
      return <Story />;
    },
  ],
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
