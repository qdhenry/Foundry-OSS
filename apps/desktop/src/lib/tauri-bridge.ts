import type {
  SandboxCancelSessionArgs,
  SandboxGetTerminalConnectionInfoArgs,
  SandboxListFilesArgs,
  SandboxListFilesResult,
  SandboxReadFileArgs,
  SandboxReadFileResult,
  SandboxRestartSessionArgs,
  SandboxSendChatMessageArgs,
  SandboxTerminalConnectionInfo,
  SandboxWriteFileArgs,
} from "@foundry/ui/backend";
import type { WorkspaceCustomizationPayload } from "@foundry/ui/sandbox";
import { logDesktop } from "./desktop-logging";

type TauriWindowInvoke = <TResult>(
  command: string,
  args?: unknown
) => Promise<TResult>;

interface TauriWindowAdapter {
  invoke: TauriWindowInvoke;
}

export interface ConfigureConvexSyncArgs {
  baseUrl?: string;
  authToken?: string;
  localDeviceId?: string;
  localDeviceName?: string;
}

export interface ConfigureConvexSyncResult {
  baseUrlConfigured: boolean;
  authTokenConfigured: boolean;
}

export interface LaunchLocalSessionArgs {
  convexSessionId: string;
  worktreeBranch: string;
  repositoryPath: string;
  baseBranch: string;
  prompt: string;
  model?: string;
  maxTurns?: number;
  mcpServerOverrides?: string[];
  workspaceCustomization?: WorkspaceCustomizationPayload;
}

export interface LaunchLocalSessionResult {
  localSessionId: string;
  convexSessionId: string;
  status: string;
}

interface EmptyTauriCommandArgs {
  [key: string]: never;
}

interface ConfigureConvexSyncCommandArgs {
  request: ConfigureConvexSyncArgs;
}

interface LaunchLocalSessionCommandArgs {
  request: LaunchLocalSessionArgs;
}

declare global {
  interface Window {
    __TAURI__?: TauriWindowAdapter;
    __TAURI_INTERNALS__?: TauriWindowAdapter;
  }
}

export const TAURI_SANDBOX_COMMAND = {
  getTerminalConnectionInfo: "get_terminal_connection_info",
  listFiles: "list_files",
  readFile: "read_file",
  writeFile: "write_file",
  sendChatMessage: "send_chat_message",
  cancelSession: "cancel_session",
  restartSession: "restart_session",
  configureConvexSync: "configure_convex_sync",
  launchLocalSession: "launch_local_session",
  pickDirectory: "pick_directory",
} as const;

interface TauriSandboxCommandMap {
  [TAURI_SANDBOX_COMMAND.getTerminalConnectionInfo]: {
    args: SandboxGetTerminalConnectionInfoArgs;
    result: SandboxTerminalConnectionInfo;
  };
  [TAURI_SANDBOX_COMMAND.listFiles]: {
    args: SandboxListFilesArgs;
    result: SandboxListFilesResult;
  };
  [TAURI_SANDBOX_COMMAND.readFile]: {
    args: SandboxReadFileArgs;
    result: SandboxReadFileResult;
  };
  [TAURI_SANDBOX_COMMAND.writeFile]: {
    args: SandboxWriteFileArgs;
    result: unknown;
  };
  [TAURI_SANDBOX_COMMAND.sendChatMessage]: {
    args: SandboxSendChatMessageArgs;
    result: unknown;
  };
  [TAURI_SANDBOX_COMMAND.cancelSession]: {
    args: SandboxCancelSessionArgs;
    result: unknown;
  };
  [TAURI_SANDBOX_COMMAND.restartSession]: {
    args: SandboxRestartSessionArgs;
    result: unknown;
  };
  [TAURI_SANDBOX_COMMAND.configureConvexSync]: {
    args: ConfigureConvexSyncCommandArgs;
    result: ConfigureConvexSyncResult;
  };
  [TAURI_SANDBOX_COMMAND.launchLocalSession]: {
    args: LaunchLocalSessionCommandArgs;
    result: LaunchLocalSessionResult;
  };
  [TAURI_SANDBOX_COMMAND.pickDirectory]: {
    args: EmptyTauriCommandArgs;
    result: string | null;
  };
}

type TauriSandboxCommand = keyof TauriSandboxCommandMap;

export class TauriBridgeUnavailableError extends Error {
  constructor() {
    super(
      "Tauri invoke bridge is unavailable in this runtime. Use cloud backend when running on web."
    );
    this.name = "TauriBridgeUnavailableError";
  }
}

function getTauriWindowAdapter(): TauriWindowAdapter | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.__TAURI__?.invoke) {
    return window.__TAURI__;
  }

  if (window.__TAURI_INTERNALS__?.invoke) {
    return window.__TAURI_INTERNALS__;
  }

  return null;
}

export function isTauriBridgeAvailable(): boolean {
  return getTauriWindowAdapter() !== null;
}

function trimmedOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function invokeTauriSandboxCommand<TCommand extends TauriSandboxCommand>(
  command: TCommand,
  args: TauriSandboxCommandMap[TCommand]["args"]
): Promise<TauriSandboxCommandMap[TCommand]["result"]> {
  const adapter = getTauriWindowAdapter();
  if (!adapter) {
    throw new TauriBridgeUnavailableError();
  }

  return adapter.invoke<TauriSandboxCommandMap[TCommand]["result"]>(
    command,
    args
  );
}

async function getDesktopTerminalConnectionInfo(
  args: SandboxGetTerminalConnectionInfoArgs
): Promise<SandboxTerminalConnectionInfo> {
  logDesktop("info", "terminal-bridge", "Requesting terminal connection info", {
    sessionId: args.sessionId,
  });
  const connectionInfo = await invokeTauriSandboxCommand(
    TAURI_SANDBOX_COMMAND.getTerminalConnectionInfo,
    args
  );
  const cwd = trimmedOrUndefined(connectionInfo.cwd);
  logDesktop("info", "terminal-bridge", "Received terminal connection info", {
    sessionId: args.sessionId,
    hasWsUrl: Boolean(connectionInfo.wsUrl),
    hasToken: Boolean(connectionInfo.token),
    transport: connectionInfo.transport ?? "websocket",
    cwd: cwd ?? null,
  });

  return {
    ...connectionInfo,
    ...(cwd ? { cwd } : {}),
  };
}

export const tauriBridge = {
  getTerminalConnectionInfo: (args: SandboxGetTerminalConnectionInfoArgs) =>
    getDesktopTerminalConnectionInfo(args),
  listFiles: (args: SandboxListFilesArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.listFiles, args),
  readFile: (args: SandboxReadFileArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.readFile, args),
  writeFile: (args: SandboxWriteFileArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.writeFile, args),
  sendChatMessage: (args: SandboxSendChatMessageArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.sendChatMessage, args),
  cancelSession: (args: SandboxCancelSessionArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.cancelSession, args),
  restartSession: (args: SandboxRestartSessionArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.restartSession, args),
  configureConvexSync: (args: ConfigureConvexSyncArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.configureConvexSync, {
      request: args,
    }),
  launchLocalSession: (args: LaunchLocalSessionArgs) =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.launchLocalSession, {
      request: args,
    }),
  pickDirectory: () =>
    invokeTauriSandboxCommand(TAURI_SANDBOX_COMMAND.pickDirectory, {}),
};

export type TauriBridge = typeof tauriBridge;
