import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildLocalDeviceId,
  resolveDesktopEditorType,
  resolveLocalDeviceInfo,
  useLocalLaunch,
} from "./useLocalLaunch";
import { tauriBridge } from "../lib/tauri-bridge";

const mocks = vi.hoisted(() => ({
  startLocal: vi.fn(),
  startSubtaskExecution: vi.fn(),
  executeSingleSubtask: vi.fn(),
  convexQuery: vi.fn(),
  authState: {
    sessionId: "session-1",
    userId: "user-1",
  },
}));

vi.mock("convex/react", () => ({
  useAction: (name: unknown) => {
    switch (String(name)) {
      case "sandbox/orchestrator:startLocal":
        return mocks.startLocal;
      case "sandbox/orchestrator:startSubtaskExecution":
        return mocks.startSubtaskExecution;
      case "sandbox/orchestrator:executeSingleSubtask":
        return mocks.executeSingleSubtask;
      default:
        return vi.fn();
    }
  },
  useConvex: () => ({
    query: mocks.convexQuery,
  }),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("../lib/tauri-bridge", () => ({
  tauriBridge: {
    launchLocalSession: vi.fn(),
  },
}));

describe("useLocalLaunch", () => {
  beforeEach(() => {
    mocks.startLocal.mockReset();
    mocks.startSubtaskExecution.mockReset();
    mocks.executeSingleSubtask.mockReset();
    mocks.convexQuery.mockReset();
    mocks.authState.sessionId = "session-1";
    mocks.authState.userId = "user-1";

    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "TestOS",
    });

    mocks.convexQuery.mockResolvedValue([
      {
        _id: "repo-1",
        repoFullName: "acme/foundry-app",
        defaultBranch: "develop",
        localPath: "/Users/test/work/acme-foundry",
      },
    ]);

    mocks.startLocal.mockResolvedValue({
      sessionId: "session-1",
      worktreeBranch: "foundry/task-task-1",
    });

    mocks.startSubtaskExecution.mockResolvedValue({
      sessionId: "session-subtasks",
      worktreeBranch: "foundry/task-task-1",
    });

    mocks.executeSingleSubtask.mockResolvedValue({
      sessionId: "session-subtask",
      worktreeBranch: "foundry/task-task-1",
    });

    vi.mocked(tauriBridge.launchLocalSession).mockReset();
    vi.mocked(tauriBridge.launchLocalSession).mockResolvedValue({
      localSessionId: "session-1",
      convexSessionId: "session-1",
      status: "queued",
    });
  });

  it("starts a local standard session and launches the tauri local execution pipeline", async () => {
    const { result } = renderHook(() => useLocalLaunch());

    await expect(
      result.current({
        taskId: "task-1",
        programId: "program-1",
        repositoryId: "repo-1",
        taskPrompt: "Implement this task",
        skillId: "skill-1",
        model: "claude-sonnet-4-6",
        editorType: "monaco",
        ttlMinutes: 20,
        authProvider: "anthropic",
        mcpServerOverrides: ["filesystem", "github"],
        workspaceCustomization: {
          dotfiles: [{ path: ".npmrc", content: "registry=https://registry.npmjs.org/" }],
        },
      })
    ).resolves.toEqual({ sessionId: "session-1" });

    const localDeviceInfo = resolveLocalDeviceInfo();
    const localDeviceId = buildLocalDeviceId(
      localDeviceInfo.localDeviceId,
      mocks.authState.userId,
      mocks.authState.sessionId
    );

    expect(mocks.convexQuery).toHaveBeenCalledWith(
      "sourceControl/repositories:listByProgram",
      { programId: "program-1" }
    );
    expect(mocks.startLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        repositoryId: "repo-1",
        taskPrompt: "Implement this task",
        skillId: "skill-1",
        model: "claude-sonnet-4-6",
        editorType: "codemirror",
        ttlMinutes: 20,
        authProvider: "anthropic",
        localDeviceId,
        localDeviceName: localDeviceInfo.localDeviceName,
      })
    );
    expect(tauriBridge.launchLocalSession).toHaveBeenCalledWith({
      convexSessionId: "session-1",
      worktreeBranch: "foundry/task-task-1",
      repositoryPath: "/Users/test/work/acme-foundry",
      baseBranch: "develop",
      prompt: "Implement this task",
      model: "claude-sonnet-4-6",
      mcpServerOverrides: ["filesystem", "github"],
      workspaceCustomization: {
        dotfiles: [{ path: ".npmrc", content: "registry=https://registry.npmjs.org/" }],
      },
    });
  });

  it("routes single-subtask local launches through executeSingleSubtask with runtime=local", async () => {
    const { result } = renderHook(() => useLocalLaunch());

    await expect(
      result.current({
        taskId: "task-1",
        programId: "program-1",
        repositoryId: "repo-1",
        taskPrompt: "Run selected subtask",
        subtaskId: "subtask-1",
        mcpServerOverrides: ["filesystem", "github"],
      })
    ).resolves.toEqual({ sessionId: "session-subtask" });

    expect(mocks.executeSingleSubtask).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        repositoryId: "repo-1",
        taskPrompt: "Run selected subtask",
        subtaskId: "subtask-1",
        runtime: "local",
        mcpServerOverrides: ["filesystem", "github"],
      })
    );
    expect(mocks.startLocal).not.toHaveBeenCalled();
    expect(mocks.startSubtaskExecution).not.toHaveBeenCalled();
    expect(tauriBridge.launchLocalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        convexSessionId: "session-subtask",
        worktreeBranch: "foundry/task-task-1",
        mcpServerOverrides: ["filesystem", "github"],
      })
    );
  });

  it("coerces monaco editor requests to codemirror for desktop sessions", () => {
    expect(resolveDesktopEditorType("monaco")).toBe("codemirror");
    expect(resolveDesktopEditorType("codemirror")).toBe("codemirror");
    expect(resolveDesktopEditorType("none")).toBe("none");
    expect(resolveDesktopEditorType(undefined)).toBeUndefined();
  });

  it("normalizes local device IDs to lowercase safe values", () => {
    expect(buildLocalDeviceId("Desktop-Host_Test.OS", "User-1", "Session.2")).toBe(
      "desktop-host_test.os-user-1-session.2"
    );
  });

  it("replaces unsupported characters, trims edge dashes, and falls back when empty", () => {
    expect(buildLocalDeviceId("  ##DESKTOP$$  ", "üser", null)).toBe("desktop----ser");
    expect(buildLocalDeviceId("   ", "###", "")).toBe("desktop-unknown");
  });
});
