import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { SandboxLogSummary } from "./SandboxLogSummary";

/**
 * SandboxLogSummary uses useQuery(api.sandbox.logs.summaryByTask).
 * The Convex mock resolves this to key "logs:summaryByTask".
 * We inject mock data via setMockOverrides in decorators.
 *
 * The component renders null when summary === undefined or summary.totalCount === 0.
 * Stories use decorators to seed the summary mock data.
 */

// ── Mock helpers ──────────────────────────────────────────────────────────────

type MockStore = { setMockOverrides: (o: Record<string, unknown>) => void };
const convexMock = (): MockStore =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../../../.storybook/mocks/convex") as MockStore;

const NOW = Date.now();
const secondsAgo = (s: number) => NOW - s * 1000;

const makeRecentLog = (level: string, message: string, offsetSecs = 0) => ({
  _id: `log-${level}-${offsetSecs}`,
  level,
  message,
  timestamp: secondsAgo(offsetSecs),
  taskId: "task-1",
});

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof SandboxLogSummary> = {
  title: "Audit/SandboxLogSummary",
  component: SandboxLogSummary,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    taskId: {
      description: "The Convex task ID used to fetch the log summary via useQuery",
      control: "text",
    },
  },
};

export default meta;
type Story = StoryObj<typeof SandboxLogSummary>;

// ── Stories ───────────────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 12,
          levelCounts: { info: 8, stdout: 3, stderr: 1 },
          recentLogs: [
            makeRecentLog("info", "Sandbox session started", 120),
            makeRecentLog("stdout", "npm install completed in 12.3s", 80),
            makeRecentLog("info", "Task execution complete", 5),
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const Collapsed: Story = {
  name: "Collapsed (default state)",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 7,
          levelCounts: { info: 5, stdout: 2 },
          recentLogs: [
            makeRecentLog("info", "Session initialized", 60),
            makeRecentLog("stdout", "Build complete: 0 errors", 10),
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const WithErrors: Story = {
  name: "With Error and Stderr Logs",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 15,
          levelCounts: { info: 6, stdout: 4, stderr: 3, error: 2 },
          recentLogs: [
            makeRecentLog(
              "stderr",
              "TypeError: Cannot read properties of undefined (reading 'sku')",
              45,
            ),
            makeRecentLog(
              "error",
              "Execution failed: unhandled exception in sku-mapper.ts line 42",
              40,
            ),
            makeRecentLog("info", "Sandbox terminated with error", 35),
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const InfoOnly: Story = {
  name: "Info Logs Only",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 5,
          levelCounts: { info: 5 },
          recentLogs: [
            makeRecentLog("info", "Sandbox session started", 60),
            makeRecentLog("info", "Repository cloned successfully", 50),
            makeRecentLog("info", "Task complete", 5),
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const HighVolume: Story = {
  name: "High Volume (many logs)",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 342,
          levelCounts: { info: 200, stdout: 100, stderr: 30, error: 8, system: 4 },
          recentLogs: [
            makeRecentLog("stdout", "Processed batch 34/34: 247 records OK", 10),
            makeRecentLog("info", "Writing output file", 8),
            makeRecentLog("info", "Task complete — 342 log entries recorded", 2),
          ],
        },
      });
      return <Story />;
    },
  ],
};

export const ExpandedWithStructuredLog: Story = {
  name: "Expanded — Structured stdout Log",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 8,
          levelCounts: { info: 5, stdout: 3 },
          recentLogs: [
            makeRecentLog(
              "stdout",
              JSON.stringify([
                {
                  type: "assistant",
                  message: {
                    content: [
                      {
                        type: "tool_use",
                        name: "Write",
                        input: {
                          file_path: "/workspace/src/sku-mapper.ts",
                          content:
                            "export function mapSku(magento: string): string { return `SF-${magento}`; }",
                        },
                      },
                    ],
                  },
                },
              ]),
              30,
            ),
            makeRecentLog("info", "File written successfully", 25),
            makeRecentLog("info", "Task complete", 5),
          ],
        },
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button");
    await expect(toggle).toBeVisible();
    await userEvent.click(toggle);
  },
};

export const InteractiveExpand: Story = {
  name: "Interactive: Expand / Collapse",
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 10,
          levelCounts: { info: 7, stdout: 2, stderr: 1 },
          recentLogs: [
            makeRecentLog("info", "Session started", 90),
            makeRecentLog("stdout", "Build output: OK", 40),
            makeRecentLog("stderr", "deprecated: react-scripts@4", 20),
          ],
        },
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("button");
    // Expand
    await userEvent.click(toggle);
    // Collapse
    await userEvent.click(toggle);
  },
};

export const Mobile: Story = {
  args: {
    taskId: "task-1" as any,
  },
  decorators: [
    (Story) => {
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 9,
          levelCounts: { info: 6, stdout: 2, error: 1 },
          recentLogs: [
            makeRecentLog("info", "Sandbox started", 60),
            makeRecentLog("error", "Build warning detected", 20),
            makeRecentLog("info", "Complete", 5),
          ],
        },
      });
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
      convexMock().setMockOverrides({
        "logs:summaryByTask": {
          totalCount: 12,
          levelCounts: { info: 8, stdout: 3, stderr: 1 },
          recentLogs: [
            makeRecentLog("info", "Session started", 120),
            makeRecentLog("stdout", "npm install completed", 80),
            makeRecentLog("info", "Done", 5),
          ],
        },
      });
      return <Story />;
    },
  ],
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
