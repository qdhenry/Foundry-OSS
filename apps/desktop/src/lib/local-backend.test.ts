import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalSandboxBackend, LocalSandboxBackend } from "./local-backend";
import { TAURI_SANDBOX_COMMAND, TauriBridgeUnavailableError } from "./tauri-bridge";

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

describe("local sandbox backend", () => {
  beforeEach(() => {
    clearTauriGlobals();
  });

  afterEach(() => {
    clearTauriGlobals();
  });

  it("creates a LocalSandboxBackend instance", () => {
    expect(createLocalSandboxBackend()).toBeInstanceOf(LocalSandboxBackend);
  });

  it("throws TauriBridgeUnavailableError when desktop runtime is missing", async () => {
    const backend = createLocalSandboxBackend();

    const calls = [
      () => backend.getTerminalConnectionInfo({ sessionId: "session-1" }),
      () => backend.listFiles({ sessionId: "session-1", path: "/" }),
      () => backend.readFile({ sessionId: "session-1", path: "README.md" }),
      () =>
        backend.writeFile({
          sessionId: "session-1",
          path: "README.md",
          content: "test",
        }),
      () =>
        backend.sendChatMessage({
          sessionId: "session-1",
          content: "hello",
          role: "user",
        }),
      () => backend.cancelSession({ sessionId: "session-1" }),
      () => backend.restartSession({ sessionId: "session-1" }),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toBeInstanceOf(TauriBridgeUnavailableError);
    }
  });

  it("delegates each API to tauri invoke with the expected command contract", async () => {
    const invokeMock = vi.fn();
    getRuntimeWindow().__TAURI__ = { invoke: invokeMock };
    const backend = createLocalSandboxBackend();

    const calls = [
      {
        run: () => backend.getTerminalConnectionInfo({ sessionId: "session-1" }),
        command: TAURI_SANDBOX_COMMAND.getTerminalConnectionInfo,
        args: { sessionId: "session-1" },
        result: {
          wsUrl: "ws://localhost:3000",
          token: "token-1",
          sandboxId: "session-1",
          transport: "websocket",
        },
      },
      {
        run: () => backend.listFiles({ sessionId: "session-1", path: "/" }),
        command: TAURI_SANDBOX_COMMAND.listFiles,
        args: { sessionId: "session-1", path: "/" },
        result: { cwd: "/", entries: [] },
      },
      {
        run: () => backend.readFile({ sessionId: "session-1", path: "README.md" }),
        command: TAURI_SANDBOX_COMMAND.readFile,
        args: { sessionId: "session-1", path: "README.md" },
        result: { path: "README.md", content: "hello" },
      },
      {
        run: () =>
          backend.writeFile({
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
          backend.sendChatMessage({
            sessionId: "session-1",
            content: "hello",
            role: "user",
          }),
        command: TAURI_SANDBOX_COMMAND.sendChatMessage,
        args: { sessionId: "session-1", content: "hello", role: "user" },
        result: { id: "message-1" },
      },
      {
        run: () => backend.cancelSession({ sessionId: "session-1" }),
        command: TAURI_SANDBOX_COMMAND.cancelSession,
        args: { sessionId: "session-1" },
        result: null,
      },
      {
        run: () => backend.restartSession({ sessionId: "session-1" }),
        command: TAURI_SANDBOX_COMMAND.restartSession,
        args: { sessionId: "session-1" },
        result: null,
      },
    ] as const;

    for (const [index, call] of calls.entries()) {
      invokeMock.mockResolvedValueOnce(call.result);

      await expect(call.run()).resolves.toEqual(call.result);
      expect(invokeMock).toHaveBeenNthCalledWith(index + 1, call.command, call.args);
    }
  });
});
