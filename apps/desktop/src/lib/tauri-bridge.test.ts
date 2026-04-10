import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TAURI_SANDBOX_COMMAND,
  TauriBridgeUnavailableError,
  invokeTauriSandboxCommand,
  isTauriBridgeAvailable,
  tauriBridge,
} from "./tauri-bridge";

interface TauriAdapter {
  invoke: (command: string, args?: unknown) => Promise<unknown>;
}

type RuntimeWindow = Window & {
  __TAURI__?: TauriAdapter;
  __TAURI_INTERNALS__?: TauriAdapter;
};

function getRuntimeWindow(): RuntimeWindow {
  return window as RuntimeWindow;
}

function clearTauriGlobals(): void {
  const runtimeWindow = getRuntimeWindow();
  delete runtimeWindow.__TAURI__;
  delete runtimeWindow.__TAURI_INTERNALS__;
}

describe("tauri bridge", () => {
  beforeEach(() => {
    clearTauriGlobals();
  });

  afterEach(() => {
    clearTauriGlobals();
  });

  it("detects bridge availability from window.__TAURI__", () => {
    const invokeMock = vi.fn().mockResolvedValue(null);
    getRuntimeWindow().__TAURI__ = { invoke: invokeMock };

    expect(isTauriBridgeAvailable()).toBe(true);
  });

  it("falls back to window.__TAURI_INTERNALS__ when needed", () => {
    const invokeMock = vi.fn().mockResolvedValue(null);
    getRuntimeWindow().__TAURI_INTERNALS__ = { invoke: invokeMock };

    expect(isTauriBridgeAvailable()).toBe(true);
  });

  it("returns unavailable and throws a runtime error when no adapter exists", async () => {
    expect(isTauriBridgeAvailable()).toBe(false);

    await expect(
      invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.cancelSession, {
        sessionId: "session-1",
      })
    ).rejects.toBeInstanceOf(TauriBridgeUnavailableError);
  });

  it("returns terminal connection info from backend without forcing desktop-shell transport", async () => {
    const invokeMock = vi.fn();
    const runtimeWindow = getRuntimeWindow();
    runtimeWindow.__TAURI__ = { invoke: invokeMock };

    invokeMock
      .mockResolvedValueOnce({
        wsUrl: "ws://localhost:3000",
        token: "token-1",
        sandboxId: "session-1",
        cwd: "/tmp/worktrees/session-1",
      });

    await expect(
      tauriBridge.getTerminalConnectionInfo({ sessionId: "session-1" })
    ).resolves.toEqual({
      wsUrl: "ws://localhost:3000",
      token: "token-1",
      sandboxId: "session-1",
      cwd: "/tmp/worktrees/session-1",
    });

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      TAURI_SANDBOX_COMMAND.getTerminalConnectionInfo,
      { sessionId: "session-1" }
    );
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("passes through explicit backend transport when present", async () => {
    const invokeMock = vi.fn();
    const runtimeWindow = getRuntimeWindow();
    runtimeWindow.__TAURI__ = { invoke: invokeMock };

    invokeMock
      .mockResolvedValueOnce({
        wsUrl: "ws://localhost:3000",
        token: "token-1",
        sandboxId: "session-1",
        transport: "websocket",
      });

    await expect(
      tauriBridge.getTerminalConnectionInfo({ sessionId: "session-1" })
    ).resolves.toEqual({
      wsUrl: "ws://localhost:3000",
      token: "token-1",
      sandboxId: "session-1",
      transport: "websocket",
    });

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      TAURI_SANDBOX_COMMAND.getTerminalConnectionInfo,
      { sessionId: "session-1" }
    );
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("delegates non-terminal bridge methods to invoke with expected command + args", async () => {
    const invokeMock = vi.fn();
    getRuntimeWindow().__TAURI__ = { invoke: invokeMock };

    const bridgeCalls = [
      {
        run: () => tauriBridge.listFiles({ sessionId: "session-1", path: "/" }),
        command: TAURI_SANDBOX_COMMAND.listFiles,
        args: { sessionId: "session-1", path: "/" },
        result: { cwd: "/", entries: [{ name: "src", type: "directory", size: 0 }] },
      },
      {
        run: () => tauriBridge.readFile({ sessionId: "session-1", path: "README.md" }),
        command: TAURI_SANDBOX_COMMAND.readFile,
        args: { sessionId: "session-1", path: "README.md" },
        result: { path: "README.md", content: "# test" },
      },
      {
        run: () =>
          tauriBridge.writeFile({
            sessionId: "session-1",
            path: "README.md",
            content: "updated",
          }),
        command: TAURI_SANDBOX_COMMAND.writeFile,
        args: { sessionId: "session-1", path: "README.md", content: "updated" },
        result: { ok: true },
      },
      {
        run: () =>
          tauriBridge.sendChatMessage({
            sessionId: "session-1",
            content: "hello",
            role: "user",
          }),
        command: TAURI_SANDBOX_COMMAND.sendChatMessage,
        args: { sessionId: "session-1", content: "hello", role: "user" },
        result: { id: "message-1" },
      },
      {
        run: () => tauriBridge.cancelSession({ sessionId: "session-1" }),
        command: TAURI_SANDBOX_COMMAND.cancelSession,
        args: { sessionId: "session-1" },
        result: null,
      },
      {
        run: () => tauriBridge.restartSession({ sessionId: "session-1" }),
        command: TAURI_SANDBOX_COMMAND.restartSession,
        args: { sessionId: "session-1" },
        result: null,
      },
      {
        run: () =>
          tauriBridge.configureConvexSync({
            baseUrl: "https://example.convex.cloud",
            authToken: "token-1",
            localDeviceId: "desktop-alpha",
            localDeviceName: "Quinn's MacBook",
          }),
        command: TAURI_SANDBOX_COMMAND.configureConvexSync,
        args: {
          request: {
            baseUrl: "https://example.convex.cloud",
            authToken: "token-1",
            localDeviceId: "desktop-alpha",
            localDeviceName: "Quinn's MacBook",
          },
        },
        result: {
          baseUrlConfigured: true,
          authTokenConfigured: true,
        },
      },
      {
        run: () =>
          tauriBridge.launchLocalSession({
            convexSessionId: "session-1",
            worktreeBranch: "foundry/task-task-1",
            repositoryPath: "/Users/test/work/repo",
            baseBranch: "main",
            prompt: "Implement this task",
            model: "claude-sonnet-4-6",
            maxTurns: 24,
            mcpServerOverrides: ["filesystem", "github"],
            workspaceCustomization: {
              dotfiles: [{ path: ".npmrc", content: "registry=https://registry.npmjs.org/" }],
            },
          }),
        command: TAURI_SANDBOX_COMMAND.launchLocalSession,
        args: {
          request: {
            convexSessionId: "session-1",
            worktreeBranch: "foundry/task-task-1",
            repositoryPath: "/Users/test/work/repo",
            baseBranch: "main",
            prompt: "Implement this task",
            model: "claude-sonnet-4-6",
            maxTurns: 24,
            mcpServerOverrides: ["filesystem", "github"],
            workspaceCustomization: {
              dotfiles: [{ path: ".npmrc", content: "registry=https://registry.npmjs.org/" }],
            },
          },
        },
        result: {
          localSessionId: "session-1",
          convexSessionId: "session-1",
          status: "queued",
        },
      },
      {
        run: () => tauriBridge.pickDirectory(),
        command: TAURI_SANDBOX_COMMAND.pickDirectory,
        args: {},
        result: "/Users/test/work/repo",
      },
    ] as const;

    for (const [index, bridgeCall] of bridgeCalls.entries()) {
      invokeMock.mockResolvedValueOnce(bridgeCall.result);

      await expect(bridgeCall.run()).resolves.toEqual(bridgeCall.result);
      expect(invokeMock).toHaveBeenNthCalledWith(
        index + 1,
        bridgeCall.command,
        bridgeCall.args
      );
    }
  });

  it("prefers window.__TAURI__ over __TAURI_INTERNALS__", async () => {
    const primaryInvokeMock = vi.fn().mockResolvedValue({ ok: "primary" });
    const fallbackInvokeMock = vi.fn().mockResolvedValue({ ok: "fallback" });
    const runtimeWindow = getRuntimeWindow();

    runtimeWindow.__TAURI__ = { invoke: primaryInvokeMock };
    runtimeWindow.__TAURI_INTERNALS__ = { invoke: fallbackInvokeMock };

    await expect(
      invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.listFiles, {
        sessionId: "session-1",
      })
    ).resolves.toEqual({ ok: "primary" });

    expect(primaryInvokeMock).toHaveBeenCalledWith(
      TAURI_SANDBOX_COMMAND.listFiles,
      { sessionId: "session-1" }
    );
    expect(fallbackInvokeMock).not.toHaveBeenCalled();
  });
});
