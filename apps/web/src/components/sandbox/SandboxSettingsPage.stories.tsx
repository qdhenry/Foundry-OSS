import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import { setMockOverrides } from "../../../.storybook/mocks/convex";
import { SandboxSettingsPage } from "./SandboxSettingsPage";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SANDBOX_CONFIG = {
  claudeSettings: {
    model: "claude-opus-4-6",
    maxTokens: 8192,
  },
  hooks: {
    preToolUse: [{ matcher: "Write", command: "echo 'About to write a file'" }],
    postToolUse: [{ matcher: "Bash", command: "echo 'Bash tool completed'" }],
    stop: [],
    notification: [],
    error: [],
    gitOperation: [{ matcher: "*", command: "echo 'Git operation: $GIT_CMD'" }],
    fileChange: [],
    testResult: [],
  },
  mcpServers: [
    {
      name: "github-mcp",
      package: "@modelcontextprotocol/server-github",
      config: { token: "***" },
      level: "global",
    },
    {
      name: "filesystem-mcp",
      package: "@modelcontextprotocol/server-filesystem",
      config: {},
      level: "project",
    },
  ],
  shellAliases: [
    { name: "gs", command: "git status" },
    { name: "ll", command: "ls -la" },
  ],
  dotfiles: [{ path: ".bashrc", content: "export PS1='\\u@sandbox:\\w$ '\nalias ll='ls -la'\n" }],
  devToolConfigs: [{ tool: "prettier", config: '{"semi":false,"singleQuote":true}' }],
  setupScripts: [
    { name: "install-deps", script: "#!/bin/bash\nnpm install", runOrder: 1 },
    { name: "run-migrations", script: "#!/bin/bash\nnpx convex dev --once", runOrder: 2 },
  ],
};

const MOCK_ENV_VARS = [
  { _id: "env-1", name: "ANTHROPIC_API_KEY", description: "Claude API key for sandbox agents" },
  { _id: "env-2", name: "GITHUB_TOKEN", description: "GitHub personal access token" },
  { _id: "env-3", name: "DATABASE_URL", description: undefined },
];

const MOCK_PRESETS = [
  {
    _id: "preset-1",
    name: "Standard TypeScript",
    editorType: "monaco" as const,
    ttlMinutes: 15,
    isDefault: true,
  },
  {
    _id: "preset-2",
    name: "Full Stack + MCP",
    editorType: "monaco" as const,
    ttlMinutes: 30,
    isDefault: false,
  },
  {
    _id: "preset-3",
    name: "Lightweight (no editor)",
    editorType: "none" as const,
    ttlMinutes: 10,
    isDefault: false,
  },
];

const MOCK_AI_PROVIDERS = [
  {
    _id: "prov-1",
    provider: "anthropic" as const,
    isDefault: true,
    updatedAt: Date.now() - 86400000,
  },
  {
    _id: "prov-2",
    provider: "bedrock" as const,
    isDefault: false,
    updatedAt: Date.now() - 7200000,
  },
];

const MOCK_EMPTY_CONFIG = {
  claudeSettings: {},
  hooks: {
    preToolUse: [],
    postToolUse: [],
    stop: [],
    notification: [],
    error: [],
    gitOperation: [],
    fileChange: [],
    testResult: [],
  },
  mcpServers: [],
  shellAliases: [],
  dotfiles: [],
  devToolConfigs: [],
  setupScripts: [],
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SandboxSettingsPage> = {
  title: "Sandbox/SandboxSettingsPage",
  component: SandboxSettingsPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/sandboxes/settings" },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SandboxSettingsPage>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Default — Claude Settings tab",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
};

export const EmptyConfig: Story = {
  name: "Empty config — no settings yet",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_EMPTY_CONFIG,
        "envVault:listByOrg": [],
        "presets:listForOrg": [],
        "aiProviders:listMine": [],
      });
      return <Story />;
    },
  ],
};

export const Loading: Story = {
  name: "Loading state",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": undefined,
        "envVault:listByOrg": undefined,
        "presets:listForOrg": undefined,
        "aiProviders:listMine": undefined,
      });
      return <Story />;
    },
  ],
};

export const HooksTab: Story = {
  name: "Hooks tab — pre-configured hooks",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const hooksTab = canvas.getByRole("button", { name: "Hooks" });
    await userEvent.click(hooksTab);
  },
};

export const MCPTab: Story = {
  name: "MCP Servers tab",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const mcpTab = canvas.getByRole("button", { name: "MCP Servers" });
    await userEvent.click(mcpTab);
  },
};

export const WorkspaceTab: Story = {
  name: "Workspace tab — dotfiles and scripts",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const workspaceTab = canvas.getByRole("button", { name: "Workspace" });
    await userEvent.click(workspaceTab);
  },
};

export const EnvVaultTab: Story = {
  name: "Env Vault tab — stored secrets",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const vaultTab = canvas.getByRole("button", { name: "Env Vault" });
    await userEvent.click(vaultTab);
  },
};

export const PresetsTab: Story = {
  name: "Presets tab — org presets",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const presetsTab = canvas.getByRole("button", { name: "Presets" });
    await userEvent.click(presetsTab);
  },
};

export const AIProvidersTab: Story = {
  name: "AI Providers tab — credentials",
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const providersTab = canvas.getByRole("button", { name: "AI Providers" });
    await userEvent.click(providersTab);
  },
};

export const NoOrganization: Story = {
  name: "No organization selected",
  decorators: [
    (Story) => {
      // Override Clerk mock to return no orgId
      // The component checks orgId from useOrganization — setting config to
      // undefined simulates the "no org" guard state shown in the component.
      setMockOverrides({
        "configs:getByOrg": null,
        "envVault:listByOrg": [],
        "presets:listForOrg": [],
        "aiProviders:listMine": [],
      });
      return <Story />;
    },
  ],
};

export const Mobile: Story = {
  name: "Mobile viewport",
  parameters: { viewport: { defaultViewport: "mobile" } },
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
};

export const Tablet: Story = {
  name: "Tablet viewport",
  parameters: { viewport: { defaultViewport: "tablet" } },
  decorators: [
    (Story) => {
      setMockOverrides({
        "configs:getByOrg": MOCK_SANDBOX_CONFIG,
        "envVault:listByOrg": MOCK_ENV_VARS,
        "presets:listForOrg": MOCK_PRESETS,
        "aiProviders:listMine": MOCK_AI_PROVIDERS,
      });
      return <Story />;
    },
  ],
};
