import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { useEffect } from "react";
import { SandboxHUDProvider, useSandboxHUD } from "@/lib/sandboxHUDContext";
import { setMockOverrides } from "../../../.storybook/mocks/convex";
import { SandboxHUD } from "./SandboxHUD";

// ---------------------------------------------------------------------------
// SandboxHUD reads all state from SandboxHUDContext. Each story uses a thin
// Initializer component to pre-populate tabs via openTab() on mount, so the
// HUD renders with meaningful content without any real Convex data.
// ---------------------------------------------------------------------------

interface TabSpec {
  sessionId: string;
  taskId: string;
  programSlug: string;
  taskTitle: string;
  status: string;
  setupProgress?: unknown;
  runtimeMode?: string | null;
  subTab?: "logs" | "terminal" | "files" | "editor" | "audit" | "chat";
}

function HUDInitializer({
  tabs,
  expandedOnMount = true,
}: {
  tabs: TabSpec[];
  expandedOnMount?: boolean;
}) {
  const { openTab, setExpanded } = useSandboxHUD();

  useEffect(() => {
    for (const tab of tabs) {
      openTab({
        sessionId: tab.sessionId,
        taskId: tab.taskId,
        programSlug: tab.programSlug,
        taskTitle: tab.taskTitle,
        status: tab.status,
        setupProgress: tab.setupProgress,
        runtimeMode: tab.runtimeMode ?? null,
      });
    }
    if (expandedOnMount) {
      setExpanded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function HUDStory({
  tabs,
  expandedOnMount = true,
  mockSession,
}: {
  tabs: TabSpec[];
  expandedOnMount?: boolean;
  mockSession?: Record<string, unknown>;
}) {
  return (
    <SandboxHUDProvider>
      <HUDInitializer tabs={tabs} expandedOnMount={expandedOnMount} />
      {/* Page content behind the HUD */}
      <div style={{ paddingBottom: "420px", padding: "24px" }}>
        <div className="rounded-xl border border-border-default bg-surface-default p-6">
          <h2 className="text-lg font-semibold text-text-heading">Page Content</h2>
          <p className="mt-2 text-sm text-text-secondary">
            The HUD is anchored to the bottom of the viewport. Scroll or resize to see how it
            interacts with page content.
          </p>
        </div>
      </div>
      <SandboxHUD />
    </SandboxHUDProvider>
  );
}

// ---------------------------------------------------------------------------
// Mock sessions (returned by useQuery for session details)
// ---------------------------------------------------------------------------

const SESSION_READY = {
  _id: "sess-hud-1",
  status: "ready",
  setupProgress: null,
  runtimeMode: "idle",
  worktreeBranch: "foundry/task-checkout-validation",
  isPinned: false,
  prUrl: null,
  editorType: "monaco",
};

const SESSION_EXECUTING = {
  _id: "sess-hud-2",
  status: "executing",
  setupProgress: null,
  runtimeMode: "executing",
  worktreeBranch: "foundry/task-product-import",
  isPinned: true,
  prUrl: null,
  editorType: "monaco",
};

const SESSION_PROVISIONING = {
  _id: "sess-hud-3",
  status: "provisioning",
  setupProgress: {
    stage: "gitClone",
    completedStages: ["containerProvision", "systemSetup", "authSetup"],
    totalStages: 10,
  },
  runtimeMode: null,
  worktreeBranch: null,
  isPinned: false,
  prUrl: null,
  editorType: "monaco",
};

const SESSION_COMPLETED = {
  _id: "sess-hud-4",
  status: "completed",
  setupProgress: null,
  runtimeMode: null,
  worktreeBranch: "foundry/task-order-etl",
  isPinned: false,
  prUrl: "https://github.com/org/repo/pull/99",
  editorType: "monaco",
};

const SESSION_FAILED = {
  _id: "sess-hud-5",
  status: "failed",
  setupProgress: null,
  runtimeMode: null,
  worktreeBranch: "foundry/task-failed-task",
  isPinned: false,
  prUrl: null,
  editorType: "none",
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta = {
  title: "Sandbox/SandboxHUD",
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The Sandbox HUD is a fixed bottom panel that hosts one or more sandbox sessions as " +
          "resizable tabs. It is driven entirely by SandboxHUDContext. Each story pre-populates " +
          "tabs via an Initializer component.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const SingleTabExpanded: Story = {
  name: "Single tab — expanded",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_READY, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Implement checkout validation",
              status: "ready",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};

export const SingleTabCollapsed: Story = {
  name: "Single tab — collapsed",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_READY, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Implement checkout validation",
              status: "ready",
            },
          ]}
          expandedOnMount={false}
        />
      );
    },
  ],
};

export const MultipleTabs: Story = {
  name: "Multiple tabs — executing + ready",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_EXECUTING, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-2",
              taskId: "task-2",
              programSlug: "prog-1",
              taskTitle: "Import product catalog",
              status: "executing",
              runtimeMode: "executing",
            },
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Implement checkout validation",
              status: "ready",
              runtimeMode: "idle",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};

export const Provisioning: Story = {
  name: "Provisioning — setup in progress",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_PROVISIONING, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-3",
              taskId: "task-3",
              programSlug: "prog-1",
              taskTitle: "Build API integration layer",
              status: "provisioning",
              setupProgress: SESSION_PROVISIONING.setupProgress,
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};

export const CompletedWithPR: Story = {
  name: "Completed — PR link visible",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_COMPLETED, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-4",
              taskId: "task-4",
              programSlug: "prog-1",
              taskTitle: "Order history ETL pipeline",
              status: "completed",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};

export const Failed: Story = {
  name: "Failed session",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_FAILED, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-5",
              taskId: "task-5",
              programSlug: "prog-1",
              taskTitle: "Refactor legacy auth module",
              status: "failed",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};

export const ThreeTabs: Story = {
  name: "Three concurrent sessions",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_READY, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-2",
              taskId: "task-2",
              programSlug: "prog-1",
              taskTitle: "Import product catalog",
              status: "executing",
              runtimeMode: "executing",
            },
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Checkout validation",
              status: "ready",
            },
            {
              sessionId: "sess-hud-3",
              taskId: "task-3",
              programSlug: "prog-1",
              taskTitle: "API integration",
              status: "provisioning",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};

export const ToggleExpand: Story = {
  name: "Interactive — toggle collapse",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_READY, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Implement checkout validation",
              status: "ready",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const collapseBtn = canvas.getByRole("button", { name: /collapse hud/i });
    await userEvent.click(collapseBtn);
  },
};

export const SwitchSubTab: Story = {
  name: "Interactive — switch to Terminal sub-tab",
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_READY, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Implement checkout validation",
              status: "ready",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const terminalTab = canvas.getByRole("button", { name: "Terminal" });
    await userEvent.click(terminalTab);
  },
};

export const Mobile: Story = {
  name: "Mobile viewport",
  parameters: { viewport: { defaultViewport: "mobile" } },
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_READY, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Checkout validation",
              status: "ready",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};

export const Tablet: Story = {
  name: "Tablet viewport",
  parameters: { viewport: { defaultViewport: "tablet" } },
  decorators: [
    (_Story) => {
      setMockOverrides({ "sessions:get": SESSION_EXECUTING, "logs:listBySession": [] });
      return (
        <HUDStory
          tabs={[
            {
              sessionId: "sess-hud-2",
              taskId: "task-2",
              programSlug: "prog-1",
              taskTitle: "Import product catalog",
              status: "executing",
              runtimeMode: "executing",
            },
            {
              sessionId: "sess-hud-1",
              taskId: "task-1",
              programSlug: "prog-1",
              taskTitle: "Checkout validation",
              status: "ready",
            },
          ]}
          expandedOnMount={true}
        />
      );
    },
  ],
};
