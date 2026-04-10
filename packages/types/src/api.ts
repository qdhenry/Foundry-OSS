import type {
  LogLevel,
  SandboxStatus,
  SessionLifecycleMetadata,
} from "./sandbox";

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SDK_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface HealthResponse {
  status: "ok";
  service: "sandbox-worker";
  timestamp: string;
  sdkAvailable: boolean;
  activeSessions: number;
  version: string;
}

export interface McpServerConfig {
  package: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface CreateSandboxRequest {
  sandboxId?: string;
  orgId?: string;
  repoUrl: string;
  branch: string;
  worktreeBranch: string;
  githubToken?: string;
  installCommand?: string;
  ttlMinutes?: number;
  editorType?: "monaco" | "codemirror" | "none";
  authProvider?: "anthropic" | "bedrock" | "vertex" | "azure";
  presetId?: string;
  anthropicApiKey?: string;
  mcpServers?: McpServerConfig[];
  designFiles?: Record<string, string>;
}

export interface CreateSandboxResponse extends SessionLifecycleMetadata {
  sandboxId: string;
  status: SandboxStatus;
  createdAt: string;
  sdkAvailable: boolean;
  mode: "cloudflare" | "in-memory";
  warning?: string;
}

export interface ExecuteSandboxRequest {
  taskPrompt: string;
  timeoutMs?: number;
  anthropicApiKey?: string;
  workingDirectory?: string;
  convexUrl?: string;
  hookSecret?: string;
  useAgentSdk?: boolean;
  model?: string;
  interactive?: boolean;
  systemPromptAppend?: string;
}

export interface ExecuteSandboxResponse extends SessionLifecycleMetadata {
  sandboxId: string;
  accepted: boolean;
  startedAt: string;
  status: SandboxStatus;
}

export interface PollLogsResponse extends SessionLifecycleMetadata {
  sandboxId: string;
  status: SandboxStatus;
  entries: Array<{
    sequence: number;
    timestamp: string;
    level: LogLevel;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
  done: boolean;
  failed: boolean;
  nextCursor?: string;
  error?: string;
}

export interface FinalizeSandboxRequest {
  commitMessage?: string;
  push?: boolean;
  pushBranch?: string;
}

export interface FinalizeSandboxResponse extends SessionLifecycleMetadata {
  sandboxId: string;
  status: SandboxStatus;
  completedAt: string;
  commitSha?: string;
  filesChanged?: number;
  prUrl?: string;
}

export interface DeleteSandboxResponse extends SessionLifecycleMetadata {
  sandboxId: string;
  deleted: true;
  deletedAt: string;
}
