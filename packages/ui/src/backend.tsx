"use client";

import { useConvex } from "convex/react";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export type SandboxChatRole = "user" | "assistant" | "system";

export interface SandboxTerminalConnectionInfo {
  wsUrl: string;
  token: string;
  sandboxId: string;
  cwd?: string;
  transport?: "websocket";
}

export interface SandboxFileEntry {
  name: string;
  type: "file" | "directory" | "other";
  size: number;
}

export interface SandboxListFilesResult {
  cwd?: string;
  entries?: SandboxFileEntry[];
}

export interface SandboxReadFileResult {
  path?: string;
  content?: string;
}

export interface SandboxSessionArgs {
  sessionId: string;
}

export interface SandboxGetTerminalConnectionInfoArgs extends SandboxSessionArgs {}

export interface SandboxListFilesArgs extends SandboxSessionArgs {
  path?: string;
}

export interface SandboxReadFileArgs extends SandboxSessionArgs {
  path: string;
}

export interface SandboxWriteFileArgs extends SandboxSessionArgs {
  path: string;
  content: string;
}

export interface SandboxSendChatMessageArgs extends SandboxSessionArgs {
  content: string;
  role: SandboxChatRole;
}

export interface SandboxCancelSessionArgs extends SandboxSessionArgs {}

export interface SandboxRestartSessionArgs extends SandboxSessionArgs {}

export interface ISandboxBackend {
  getTerminalConnectionInfo: (
    args: SandboxGetTerminalConnectionInfoArgs,
  ) => Promise<SandboxTerminalConnectionInfo>;
  listFiles: (args: SandboxListFilesArgs) => Promise<SandboxListFilesResult>;
  readFile: (args: SandboxReadFileArgs) => Promise<SandboxReadFileResult>;
  writeFile: (args: SandboxWriteFileArgs) => Promise<unknown>;
  sendChatMessage: (args: SandboxSendChatMessageArgs) => Promise<unknown>;
  cancelSession: (args: SandboxCancelSessionArgs) => Promise<unknown>;
  restartSession: (args: SandboxRestartSessionArgs) => Promise<unknown>;
}

const SandboxBackendContext = createContext<ISandboxBackend | null>(null);

function useCloudSandboxBackend(): ISandboxBackend {
  const convex = useConvex();

  return useMemo<ISandboxBackend>(
    () => ({
      getTerminalConnectionInfo: ({ sessionId }) =>
        convex.action("sandbox/terminal:getConnectionInfo" as any, {
          sessionId: sessionId as any,
        }) as Promise<SandboxTerminalConnectionInfo>,
      listFiles: ({ sessionId, path }) =>
        convex.action("sandbox/files:list" as any, {
          sessionId: sessionId as any,
          path,
        }) as Promise<SandboxListFilesResult>,
      readFile: ({ sessionId, path }) =>
        convex.action("sandbox/files:read" as any, {
          sessionId: sessionId as any,
          path,
        }) as Promise<SandboxReadFileResult>,
      writeFile: ({ sessionId, path, content }) =>
        convex.action("sandbox/files:write" as any, {
          sessionId: sessionId as any,
          path,
          content,
        }),
      sendChatMessage: ({ sessionId, content, role }) =>
        convex.mutation("sandbox/sessions:sendChatMessage" as any, {
          sessionId: sessionId as any,
          content,
          role,
        }),
      cancelSession: ({ sessionId }) =>
        convex.action("sandbox/orchestrator:shutdown" as any, {
          sessionId: sessionId as any,
        }),
      restartSession: ({ sessionId }) =>
        convex.action("sandbox/orchestrator:wake" as any, {
          sessionId: sessionId as any,
        }),
    }),
    [convex],
  );
}

export function SandboxBackendProvider({
  children,
  backend,
}: {
  children: ReactNode;
  backend?: ISandboxBackend;
}) {
  if (backend) {
    return (
      <SandboxBackendContext.Provider value={backend}>{children}</SandboxBackendContext.Provider>
    );
  }

  return <CloudSandboxBackendProvider>{children}</CloudSandboxBackendProvider>;
}

function CloudSandboxBackendProvider({ children }: { children: ReactNode }) {
  const backend = useCloudSandboxBackend();

  return (
    <SandboxBackendContext.Provider value={backend}>{children}</SandboxBackendContext.Provider>
  );
}

export function useSandboxBackend(): ISandboxBackend {
  const backend = useContext(SandboxBackendContext);
  if (!backend) {
    throw new Error("useSandboxBackend must be used within a SandboxBackendProvider");
  }
  return backend;
}
