import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SandboxConfigPanel } from "./SandboxConfigPanel";

const mocks = vi.hoisted(() => ({
  hudState: {
    isConfigPanelOpen: true,
    configPanelContext: null as any,
    closeConfig: vi.fn(),
    openTab: vi.fn(),
    localLaunchHandler: undefined as ((args: unknown) => Promise<unknown>) | undefined,
  },
  queryState: {
    repositories: [] as any[] | undefined,
    skills: [] as any[] | undefined,
    models: [] as any[] | null | undefined,
  },
  actionState: {
    launchAgent: vi.fn(),
    startSubtaskExecution: vi.fn(),
    executeSingleSubtask: vi.fn(),
    ensureModelCache: vi.fn(),
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (name: unknown, args: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    switch (String(name)) {
      case "skills:listByProgram":
        return mocks.queryState.skills;
      case "sourceControl/repositories:listByProgram":
        return mocks.queryState.repositories;
      case "ai/modelsInternal:listModels":
        return mocks.queryState.models;
      default:
        return undefined;
    }
  },
  useAction: (name: unknown) => {
    switch (String(name)) {
      case "sandbox/orchestrator:start":
        return mocks.actionState.launchAgent;
      case "sandbox/orchestrator:startSubtaskExecution":
        return mocks.actionState.startSubtaskExecution;
      case "sandbox/orchestrator:executeSingleSubtask":
        return mocks.actionState.executeSingleSubtask;
      case "ai/models:ensureModelCache":
        return mocks.actionState.ensureModelCache;
      default:
        return vi.fn();
    }
  },
}));

vi.mock("./SandboxHUDContext", () => ({
  useSandboxHUD: () => mocks.hudState,
}));

const localStorageState = new Map<string, string>();

function makeConfigContext(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "task-1",
    programId: "program-1",
    programSlug: "acme",
    task: {
      title: "Implement local runtime launch",
      description: "Task details",
    },
    sandboxPresets: [],
    defaultPresetId: undefined,
    availableMcpServers: [],
    sandboxDefaults: {
      editorType: "monaco",
      ttlMinutes: 15,
      authProvider: "anthropic",
      mcpServerOverrides: [],
    },
    ...overrides,
  };
}

describe("SandboxConfigPanel", () => {
  beforeEach(() => {
    localStorageState.clear();
    const localStorageMock = {
      getItem: (key: string) => localStorageState.get(key) ?? null,
      setItem: (key: string, value: string) => {
        localStorageState.set(key, String(value));
      },
      removeItem: (key: string) => {
        localStorageState.delete(key);
      },
      clear: () => {
        localStorageState.clear();
      },
      key: (index: number) => Array.from(localStorageState.keys())[index] ?? null,
      get length() {
        return localStorageState.size;
      },
    } satisfies Storage;

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });

    delete (window as Window & { __TAURI__?: unknown }).__TAURI__;

    mocks.hudState.isConfigPanelOpen = true;
    mocks.hudState.configPanelContext = makeConfigContext();
    mocks.hudState.closeConfig.mockReset();
    mocks.hudState.openTab.mockReset();
    mocks.hudState.localLaunchHandler = undefined;

    mocks.queryState.repositories = [
      {
        _id: "repo-1",
        repoFullName: "acme/foundry-app",
      },
    ];
    mocks.queryState.skills = [];
    mocks.queryState.models = [];

    mocks.actionState.launchAgent.mockReset();
    mocks.actionState.startSubtaskExecution.mockReset();
    mocks.actionState.executeSingleSubtask.mockReset();
    mocks.actionState.ensureModelCache.mockReset();
    mocks.actionState.launchAgent.mockResolvedValue({ sessionId: "cloud-1" });
    mocks.actionState.startSubtaskExecution.mockResolvedValue({
      sessionId: "cloud-subtasks",
    });
    mocks.actionState.executeSingleSubtask.mockResolvedValue({
      sessionId: "cloud-subtask",
    });
    mocks.actionState.ensureModelCache.mockResolvedValue(null);
  });

  it("shows desktop runtime selection when a local launch handler is available", () => {
    mocks.hudState.localLaunchHandler = vi.fn(async () => ({ sessionId: "local-1" }));

    render(<SandboxConfigPanel />);

    const localButton = screen.getByRole("button", { name: "Local" });
    const cloudButton = screen.getByRole("button", { name: "Cloud" });

    expect(localButton).toBeInTheDocument();
    expect(cloudButton).toBeInTheDocument();
    expect(localButton).toHaveAttribute("aria-pressed", "true");
    expect(cloudButton).toHaveAttribute("aria-pressed", "false");
  });

  it("removes Monaco from desktop editor choices and launches with CodeMirror", async () => {
    (window as Window & { __TAURI__?: { invoke: () => Promise<unknown> } }).__TAURI__ = {
      invoke: vi.fn(async () => null),
    };
    const localLaunchHandler = vi.fn(async () => ({ sessionId: "local-1" }));
    mocks.hudState.localLaunchHandler = localLaunchHandler;

    render(<SandboxConfigPanel />);

    expect(screen.queryByRole("button", { name: "Monaco" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CodeMirror" })).toBeInTheDocument();

    const launchButton = await screen.findByRole("button", { name: "Launch Agent" });
    await waitFor(() => {
      expect(launchButton).toBeEnabled();
    });

    const user = userEvent.setup();
    await user.click(launchButton);

    await waitFor(() => {
      expect(localLaunchHandler).toHaveBeenCalledTimes(1);
    });
    expect(localLaunchHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        editorType: "codemirror",
      }),
    );
  });

  it("routes local single-subtask launches through localLaunchHandler and opens executing runtime tabs", async () => {
    const localLaunchHandler = vi.fn(async () => ({ sessionId: "local-session-1" }));
    mocks.hudState.localLaunchHandler = localLaunchHandler;
    mocks.hudState.configPanelContext = makeConfigContext({
      subtaskId: "subtask-1",
      subtaskTitle: "Fix runtime selection",
    });

    render(<SandboxConfigPanel />);

    const launchButton = await screen.findByRole("button", { name: "Execute Subtask" });
    await waitFor(() => {
      expect(launchButton).toBeEnabled();
    });

    const user = userEvent.setup();
    await user.click(launchButton);

    await waitFor(() => {
      expect(localLaunchHandler).toHaveBeenCalledTimes(1);
    });
    expect(localLaunchHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        programId: "program-1",
        repositoryId: "repo-1",
        subtaskId: "subtask-1",
      }),
    );

    expect(mocks.actionState.launchAgent).not.toHaveBeenCalled();
    expect(mocks.actionState.startSubtaskExecution).not.toHaveBeenCalled();
    expect(mocks.actionState.executeSingleSubtask).not.toHaveBeenCalled();

    expect(mocks.hudState.openTab).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "local-session-1",
        status: "executing",
        runtimeMode: "executing",
      }),
    );
    expect(mocks.hudState.closeConfig).toHaveBeenCalled();
  });

  it("shows a safe launch error message when the thrown error is non-string", async () => {
    const localLaunchHandler = vi.fn(async () => {
      throw {
        message: {
          reason: "Remote branch not available",
        },
      };
    });
    mocks.hudState.localLaunchHandler = localLaunchHandler;

    render(<SandboxConfigPanel />);

    const launchButton = await screen.findByRole("button", { name: "Launch Agent" });
    await waitFor(() => {
      expect(launchButton).toBeEnabled();
    });

    const user = userEvent.setup();
    await user.click(launchButton);

    await waitFor(() => {
      expect(screen.getByText('{"reason":"Remote branch not available"}')).toBeInTheDocument();
    });
    expect(mocks.hudState.closeConfig).not.toHaveBeenCalled();
  });

  it("does not crash when cloud launch receives a non-coercible error object", async () => {
    mocks.hudState.localLaunchHandler = undefined;
    const nonCoercibleError = Object.create(null) as Record<string, unknown>;
    nonCoercibleError.message = { reason: "Argument mismatch" };
    mocks.actionState.launchAgent.mockRejectedValue(nonCoercibleError);

    render(<SandboxConfigPanel />);

    const launchButton = await screen.findByRole("button", { name: "Launch Agent" });
    await waitFor(() => {
      expect(launchButton).toBeEnabled();
    });

    const user = userEvent.setup();
    await user.click(launchButton);

    await waitFor(() => {
      expect(screen.getByText('{"reason":"Argument mismatch"}')).toBeInTheDocument();
    });
    expect(mocks.hudState.closeConfig).not.toHaveBeenCalled();
  });
});
