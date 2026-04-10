import type { ISandboxBackend } from "@foundry/ui/backend";

import {
  isTauriBridgeAvailable,
  tauriBridge,
  TauriBridgeUnavailableError,
} from "./tauri-bridge";

function assertDesktopRuntime(): void {
  if (!isTauriBridgeAvailable()) {
    throw new TauriBridgeUnavailableError();
  }
}

export class LocalSandboxBackend implements ISandboxBackend {
  async getTerminalConnectionInfo(args: Parameters<ISandboxBackend["getTerminalConnectionInfo"]>[0]) {
    assertDesktopRuntime();
    return tauriBridge.getTerminalConnectionInfo(args);
  }

  async listFiles(args: Parameters<ISandboxBackend["listFiles"]>[0]) {
    assertDesktopRuntime();
    return tauriBridge.listFiles(args);
  }

  async readFile(args: Parameters<ISandboxBackend["readFile"]>[0]) {
    assertDesktopRuntime();
    return tauriBridge.readFile(args);
  }

  async writeFile(args: Parameters<ISandboxBackend["writeFile"]>[0]) {
    assertDesktopRuntime();
    return tauriBridge.writeFile(args);
  }

  async sendChatMessage(args: Parameters<ISandboxBackend["sendChatMessage"]>[0]) {
    assertDesktopRuntime();
    return tauriBridge.sendChatMessage(args);
  }

  async cancelSession(args: Parameters<ISandboxBackend["cancelSession"]>[0]) {
    assertDesktopRuntime();
    return tauriBridge.cancelSession(args);
  }

  async restartSession(args: Parameters<ISandboxBackend["restartSession"]>[0]) {
    assertDesktopRuntime();
    return tauriBridge.restartSession(args);
  }
}

export function createLocalSandboxBackend(): ISandboxBackend {
  return new LocalSandboxBackend();
}
