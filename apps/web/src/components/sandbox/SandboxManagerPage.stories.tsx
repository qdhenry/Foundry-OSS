import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "@storybook/test";
import type React from "react";
import { SandboxHUDProvider } from "@/lib/sandboxHUDContext";
import { setMockOverrides } from "../../../.storybook/mocks/convex";
import { SandboxManagerPage } from "./SandboxManagerPage";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const now = Date.now();

const PROGRAMS = [
  {
    _id: "prog-acme-demo",
    name: "AcmeCorp Migration",
    clientName: "AcmeCorp",
  },
  { _id: "prog-greenfield-api", name: "Greenfield API Platform", clientName: "Acme Corp" },
];

const SESSIONS_MIXED = [
  {
    _id: "sess-1",
    status: "executing",
    taskId: "task-1",
    taskTitle: "Implement SKU mapping logic",
    worktreeBranch: "foundry/task-sku-mapping",
    runtimeMode: "executing",
    setupProgress: null,
    startedAt: now - 300000,
    updatedAt: now - 5000,
    lastActivityAt: now - 5000,
    ttlMinutes: 30,
    isPinned: true,
    connectedUsers: [{ id: "u1", name: "Sarah Chen", avatarUrl: "" }],
    connectedUserCount: 1,
  },
  {
    _id: "sess-2",
    status: "ready",
    taskId: "task-2",
    taskTitle: "Write category import script",
    worktreeBranch: "foundry/task-category-import",
    runtimeMode: "idle",
    setupProgress: null,
    startedAt: now - 600000,
    updatedAt: now - 60000,
    lastActivityAt: now - 60000,
    ttlMinutes: 15,
    isPinned: false,
    connectedUsers: [],
    connectedUserCount: 0,
  },
  {
    _id: "sess-3",
    status: "provisioning",
    taskId: "task-3",
    taskTitle: "Set up order validation pipeline",
    worktreeBranch: null,
    runtimeMode: null,
    setupProgress: {
      stage: "depsInstall",
      completedStages: [
        "containerProvision",
        "systemSetup",
        "authSetup",
        "claudeConfig",
        "gitClone",
      ],
      totalStages: 10,
    },
    startedAt: now - 120000,
    updatedAt: now - 10000,
    lastActivityAt: now - 10000,
    ttlMinutes: 15,
    isPinned: false,
    connectedUsers: [],
    connectedUserCount: 0,
  },
  {
    _id: "sess-4",
    status: "completed",
    taskId: "task-4",
    taskTitle: "Customer account migration",
    worktreeBranch: "foundry/task-customer-accounts",
    runtimeMode: null,
    setupProgress: null,
    startedAt: now - 3600000,
    completedAt: now - 1800000,
    updatedAt: now - 1800000,
    lastActivityAt: now - 1800000,
    ttlMinutes: 30,
    isPinned: false,
    connectedUsers: [],
    connectedUserCount: 0,
  },
  {
    _id: "sess-5",
    status: "failed",
    taskId: "task-5",
    taskTitle: "Rebuild product taxonomy",
    worktreeBranch: "foundry/task-product-taxonomy",
    runtimeMode: null,
    setupProgress: null,
    startedAt: now - 7200000,
    updatedAt: now - 5400000,
    lastActivityAt: now - 5400000,
    ttlMinutes: 15,
    isPinned: false,
    connectedUsers: [],
    connectedUserCount: 0,
  },
];

const SESSIONS_ACTIVE_ONLY = SESSIONS_MIXED.filter((s) =>
  ["executing", "ready", "provisioning"].includes(s.status),
);

const SESSIONS_EMPTY: never[] = [];

const TASKS = [
  { _id: "task-1", title: "Implement SKU mapping logic" },
  { _id: "task-2", title: "Write category import script" },
  { _id: "task-3", title: "Set up order validation pipeline" },
  { _id: "task-4", title: "Customer account migration" },
  { _id: "task-5", title: "Rebuild product taxonomy" },
];

// ---------------------------------------------------------------------------
// Decorator: wrap in HUDProvider (required by useSandboxHUD inside component)
// ---------------------------------------------------------------------------

function withHUDProvider(Story: React.ComponentType) {
  return (
    <SandboxHUDProvider>
      <Story />
    </SandboxHUDProvider>
  );
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta: Meta<typeof SandboxManagerPage> = {
  title: "Sandbox/SandboxManagerPage",
  component: SandboxManagerPage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    nextjs: {
      appDirectory: true,
      navigation: { pathname: "/sandboxes" },
    },
  },
  decorators: [withHUDProvider],
};

export default meta;
type Story = StoryObj<typeof SandboxManagerPage>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const Default: Story = {
  name: "Default — active and completed sessions",
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_MIXED,
        "sessions:listByProgram": SESSIONS_MIXED,
        "tasks:listByProgram": TASKS,
      });
      return <Story />;
    },
  ],
};

export const ActiveOnly: Story = {
  name: "Active sessions only",
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_ACTIVE_ONLY,
        "sessions:listByProgram": SESSIONS_ACTIVE_ONLY,
        "tasks:listByProgram": TASKS,
      });
      return <Story />;
    },
  ],
};

export const NoSessions: Story = {
  name: "No sandbox sessions yet",
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_EMPTY,
        "sessions:listByProgram": SESSIONS_EMPTY,
        "tasks:listByProgram": TASKS,
      });
      return <Story />;
    },
  ],
};

export const NoPrograms: Story = {
  name: "No programs in organisation",
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": [],
        "sessions:listByOrg": SESSIONS_EMPTY,
        "sessions:listByProgram": SESSIONS_EMPTY,
        "tasks:listByProgram": [],
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
        "programs:list": undefined,
        "sessions:listByOrg": undefined,
        "sessions:listByProgram": undefined,
        "tasks:listByProgram": undefined,
      });
      return <Story />;
    },
  ],
};

export const MultiplePrograms: Story = {
  name: "Multiple programs expanded",
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_MIXED,
        "sessions:listByProgram": SESSIONS_MIXED,
        "tasks:listByProgram": TASKS,
      });
      return <Story />;
    },
  ],
};

export const SearchFilter: Story = {
  name: "Interactive — search for a session",
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_MIXED,
        "sessions:listByProgram": SESSIONS_MIXED,
        "tasks:listByProgram": TASKS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const searchInput = canvas.getByPlaceholderText("Search task title or branch...");
    await userEvent.click(searchInput);
    await userEvent.type(searchInput, "sku");
  },
};

export const StatusFilter: Story = {
  name: "Interactive — filter by status",
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_MIXED,
        "sessions:listByProgram": SESSIONS_MIXED,
        "tasks:listByProgram": TASKS,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statusSelect = canvas.getAllByRole("combobox")[0];
    await userEvent.selectOptions(statusSelect, "executing");
  },
};

export const Mobile: Story = {
  name: "Mobile viewport",
  parameters: { viewport: { defaultViewport: "mobile" } },
  decorators: [
    (Story) => {
      setMockOverrides({
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_MIXED,
        "sessions:listByProgram": SESSIONS_MIXED,
        "tasks:listByProgram": TASKS,
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
        "programs:list": PROGRAMS,
        "sessions:listByOrg": SESSIONS_MIXED,
        "sessions:listByProgram": SESSIONS_MIXED,
        "tasks:listByProgram": TASKS,
      });
      return <Story />;
    },
  ],
};
