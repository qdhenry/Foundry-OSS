import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "@storybook/test";
import React from "react";
import { type HUDConfigContext, SandboxHUDProvider } from "@/lib/sandboxHUDContext";
import { setMockOverrides } from "../../../.storybook/mocks/convex";
import { SandboxConfigPanel } from "./SandboxConfigPanel";

// ---------------------------------------------------------------------------
// SandboxConfigPanel reads its open/context state from SandboxHUDContext.
// We wrap each story in a SandboxHUDProvider and open the panel by injecting
// the context via a thin wrapper that calls openConfig on mount.
// ---------------------------------------------------------------------------

const MOCK_TASK = {
  title: "Implement checkout form validation",
  description:
    "Add Zod-based validation to the checkout form. Ensure all required fields show inline errors and the submit button is disabled until the form is valid.",
  requirementTitle: "Form Validation",
  requirementRefId: "BM-042",
};

const MOCK_REPOS = [
  { _id: "repo-1", repoFullName: "acme-corp/salesforce-b2b" },
  { _id: "repo-2", repoFullName: "acme-corp/magento-legacy" },
];

const MOCK_SKILLS = [
  { _id: "skill-1", name: "Product Data Transform", domain: "data" },
  { _id: "skill-2", name: "Order History ETL", domain: "data" },
  { _id: "skill-3", name: "API Integration", domain: "backend" },
];

const MOCK_PRESETS = [
  {
    _id: "preset-1",
    name: "Standard TypeScript",
    editorType: "monaco",
    ttlMinutes: 15,
    isDefault: true,
  },
  {
    _id: "preset-2",
    name: "Full Stack + MCP",
    editorType: "monaco",
    ttlMinutes: 30,
    isDefault: false,
  },
];

const MOCK_MCP_SERVERS = [
  { id: "github-mcp", label: "GitHub MCP" },
  { id: "filesystem-mcp", label: "Filesystem MCP" },
  { id: "postgres-mcp", label: "PostgreSQL MCP" },
];

const BASE_CONTEXT: HUDConfigContext = {
  taskId: "task-1",
  programId: "prog-acme-demo",
  programSlug: "acme-demo",
  task: MOCK_TASK,
  sandboxPresets: MOCK_PRESETS,
  defaultPresetId: "preset-1",
  sandboxDefaults: {
    editorType: "monaco" as const,
    ttlMinutes: 15,
    authProvider: "anthropic" as const,
  },
  availableMcpServers: MOCK_MCP_SERVERS,
};

// Wrapper that opens the config panel immediately on mount
function _PanelOpener({
  context,
  children,
}: {
  context: Parameters<
    ReturnType<typeof import("@/lib/sandboxHUDContext").useSandboxHUD>["openConfig"]
  >[0];
  children: React.ReactNode;
}) {
  const { openConfig } = (
    require("@/lib/sandboxHUDContext") as typeof import("@/lib/sandboxHUDContext")
  ).useSandboxHUD();

  React.useEffect(() => {
    openConfig(context);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

// Decorator that wraps story in HUDProvider + opens panel
function withOpenPanel(context: HUDConfigContext) {
  // Return a decorator factory
  return (Story: React.ComponentType) => {
    // Use a self-contained component so hooks work correctly
    function Wrapper() {
      const { openConfig } = (
        require("@/lib/sandboxHUDContext") as typeof import("@/lib/sandboxHUDContext")
      ).useSandboxHUD();

      React.useEffect(() => {
        openConfig(context as any);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return <Story />;
    }

    return (
      <SandboxHUDProvider>
        <div style={{ position: "relative", minHeight: "600px" }}>
          <Wrapper />
          <SandboxConfigPanel />
        </div>
      </SandboxHUDProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SandboxConfigPanel> = {
  title: "Sandbox/SandboxConfigPanel",
  component: SandboxConfigPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Slide-out configuration panel for launching a sandbox agent. " +
          "Reads open state and context from SandboxHUDContext. " +
          "Requires SandboxHUDProvider in the tree — each story wraps with one.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SandboxConfigPanel>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Default — assign to agent",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel(BASE_CONTEXT)(Story);
    },
  ],
};

export const SingleRepository: Story = {
  name: "Single repo — auto-selected",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": [MOCK_REPOS[0]],
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel(BASE_CONTEXT)(Story);
    },
  ],
};

export const NoRepositories: Story = {
  name: "No repositories connected",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": [],
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel(BASE_CONTEXT)(Story);
    },
  ],
};

export const ExecuteSubtask: Story = {
  name: "Execute single subtask",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel({
        ...BASE_CONTEXT,
        subtaskId: "subtask-1",
        subtaskTitle: "Add Zod schema for checkout fields",
        subtaskPrompt:
          "Create a Zod schema for the checkout form fields: name, email, address, city, zip, cardNumber.",
      })(Story);
    },
  ],
};

export const ExecuteMultipleSubtasks: Story = {
  name: "Execute 3 selected subtasks",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel({
        ...BASE_CONTEXT,
        subtaskIds: ["subtask-1", "subtask-2", "subtask-3"],
        subtaskTitle: undefined,
      })(Story);
    },
  ],
};

export const ExecuteAllSubtasks: Story = {
  name: "Execute all subtasks",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel({
        ...BASE_CONTEXT,
        mode: "allSubtasks",
      })(Story);
    },
  ],
};

export const WithModelOptions: Story = {
  name: "With model options loaded",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": [
          { id: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
          { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
          { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" },
        ],
      });
      return withOpenPanel(BASE_CONTEXT)(Story);
    },
  ],
};

export const ChangeEditorType: Story = {
  name: "Interactive — change editor type",
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel(BASE_CONTEXT)(Story);
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the CodeMirror editor type button
    const codeMirrorBtn = canvas.getByRole("button", { name: "CodeMirror" });
    await userEvent.click(codeMirrorBtn);
    await expect(codeMirrorBtn).toHaveClass(/bg-surface-default/);
  },
};

export const Mobile: Story = {
  name: "Mobile viewport",
  parameters: {
    viewport: { defaultViewport: "mobile" },
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel(BASE_CONTEXT)(Story);
    },
  ],
};

export const Tablet: Story = {
  name: "Tablet viewport",
  parameters: {
    viewport: { defaultViewport: "tablet" },
  },
  decorators: [
    (Story) => {
      setMockOverrides({
        "repositories:listByProgram": MOCK_REPOS,
        "skills:listByProgram": MOCK_SKILLS,
        "modelsInternal:listModels": null,
      });
      return withOpenPanel(BASE_CONTEXT)(Story);
    },
  ],
};
