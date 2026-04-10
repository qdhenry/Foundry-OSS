import type {
  ApiError,
  CreateSandboxRequest,
  ExecuteSandboxRequest,
  SandboxLogStreamEvent,
  SetupProgress,
  SetupStageName,
  StageState,
} from "@foundry/types";
import { SETUP_STAGE_SEQUENCE } from "./types";

export interface ExecOptions {
  timeoutMs?: number;
  env?: Record<string, string>;
  displayCommand?: string;
  logMetadata?: Record<string, unknown>;
}

const STAGE_STATUS_VALUES = new Set(["pending", "running", "completed", "failed", "skipped"]);

export function createPendingSetupProgress(): SetupProgress {
  const pendingState = (): StageState => ({ status: "pending" });
  return {
    containerProvision: pendingState(),
    systemSetup: pendingState(),
    authSetup: pendingState(),
    claudeConfig: pendingState(),
    gitClone: pendingState(),
    depsInstall: pendingState(),
    mcpInstall: pendingState(),
    workspaceCustomization: pendingState(),
    healthCheck: pendingState(),
    ready: pendingState(),
  };
}

function isStageState(value: unknown): value is StageState {
  if (!isRecord(value)) return false;
  const status = value.status;
  if (typeof status !== "string" || !STAGE_STATUS_VALUES.has(status)) {
    return false;
  }

  if (status === "pending") return true;
  if (status === "running") {
    return typeof value.startedAt === "number" && Number.isFinite(value.startedAt);
  }
  if (status === "completed") {
    return (
      typeof value.startedAt === "number" &&
      Number.isFinite(value.startedAt) &&
      typeof value.completedAt === "number" &&
      Number.isFinite(value.completedAt)
    );
  }
  if (status === "failed") {
    return (
      typeof value.startedAt === "number" &&
      Number.isFinite(value.startedAt) &&
      typeof value.failedAt === "number" &&
      Number.isFinite(value.failedAt) &&
      typeof value.error === "string"
    );
  }
  return (
    typeof value.reason === "string" &&
    typeof value.skippedAt === "number" &&
    Number.isFinite(value.skippedAt)
  );
}

export function normalizeSetupProgress(value: unknown): SetupProgress {
  const defaultProgress = createPendingSetupProgress();
  if (!isRecord(value)) {
    return defaultProgress;
  }

  const output = { ...defaultProgress };
  for (const stage of SETUP_STAGE_SEQUENCE) {
    const stageState = value[stage];
    if (isStageState(stageState)) {
      output[stage] = stageState;
    }
  }
  return output;
}

export function stageMetadata(
  stage: SetupStageName,
  stageStatus: StageState["status"],
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    stage,
    stageStatus,
    ...(extra ?? {}),
  };
}

export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildCloneUrl(repoUrl: string, githubToken?: string): string {
  const normalized = normalizeRepoUrl(repoUrl);
  if (!githubToken?.trim()) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    if (url.hostname === "github.com") {
      url.username = "x-access-token";
      url.password = githubToken.trim();
      return url.toString();
    }
    return normalized;
  } catch {
    return normalized;
  }
}

export function normalizeRepoUrl(repoUrl: string): string {
  const trimmed = repoUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.endsWith(".git") ? trimmed : `${trimmed}.git`;
  }
  const normalized = trimmed.replace(/^github\.com\//, "").replace(/\.git$/, "");
  return `https://github.com/${normalized}.git`;
}

export function redactRepoUrl(repoUrl: string): string {
  try {
    const url = new URL(repoUrl);
    if (url.password) {
      url.password = "***";
    }
    if (url.username) {
      url.username = "x-access-token";
    }
    return url.toString();
  } catch {
    return repoUrl.replace(/x-access-token:[^@]+@/, "x-access-token:***@");
  }
}

export function decodeStreamData(data: unknown): string {
  if (typeof data === "string") return data;
  if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    // Handle serialized byte buffers: {"0": 100, "1": 97, ...}
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length > 0 && entries.every(([k, v]) => /^\d+$/.test(k) && typeof v === "number")) {
      const bytes = new Uint8Array(
        entries.sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v as number),
      );
      return new TextDecoder().decode(bytes);
    }
    return JSON.stringify(data);
  }
  return String(data ?? "");
}

export function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "Unknown error";
}

export function extractExitCode(result: unknown): number | undefined {
  if (!isRecord(result)) {
    return undefined;
  }

  const maybeCode = result.exitCode ?? result.code ?? result.status;
  if (typeof maybeCode === "number" && Number.isFinite(maybeCode)) {
    return maybeCode;
  }
  if (typeof maybeCode === "string") {
    const parsed = Number(maybeCode);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

export function extractTextOutput(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (!isRecord(result)) {
    return "";
  }
  return firstString(result.stdout, result.output, result.message, result.text) || "";
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
}

export function formatSse(event: SandboxLogStreamEvent): string {
  const id = event.type === "log" ? String(event.log.sequence) : undefined;
  const lines = [];
  if (id) {
    lines.push(`id: ${id}`);
  }
  lines.push(`event: ${event.type}`);
  lines.push(`data: ${JSON.stringify(event)}`);
  return `${lines.join("\n")}\n\n`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export function toExecOptions(options: ExecOptions): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (typeof options.timeoutMs === "number") {
    result.timeout = options.timeoutMs;
  }
  if (options.env && Object.keys(options.env).length > 0) {
    result.env = options.env;
  }
  return result;
}

export function validateCreateRequest(request: CreateSandboxRequest): ApiError | null {
  if (!isNonEmptyString(request.repoUrl)) {
    return {
      code: "BAD_REQUEST",
      message: "repoUrl is required.",
    };
  }

  if (!isNonEmptyString(request.branch)) {
    return {
      code: "BAD_REQUEST",
      message: "branch is required.",
    };
  }

  if (!isNonEmptyString(request.worktreeBranch)) {
    return {
      code: "BAD_REQUEST",
      message: "worktreeBranch is required.",
    };
  }

  return null;
}

const TERMINAL_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function generateTerminalToken(sandboxId: string, secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const payload = `${sandboxId}:${timestamp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${timestamp}:${hex}`;
}

export async function validateTerminalToken(
  token: string,
  sandboxId: string,
  secret: string,
): Promise<boolean> {
  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return false;
  const timestamp = token.slice(0, colonIdx);
  const sig = token.slice(colonIdx + 1);
  if (!timestamp || !sig) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Date.now() - ts > TERMINAL_TOKEN_TTL_MS) return false;

  // Recompute HMAC using the original timestamp from the token
  const payload = `${sandboxId}:${timestamp}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = new Uint8Array(sig.match(/.{2}/g)?.map((b) => parseInt(b, 16)));
  return crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(payload));
}

export function validateExecuteRequest(request: ExecuteSandboxRequest): ApiError | null {
  if (!isNonEmptyString(request.taskPrompt)) {
    return {
      code: "BAD_REQUEST",
      message: "taskPrompt is required.",
    };
  }

  if (
    typeof request.timeoutMs === "number" &&
    (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0)
  ) {
    return {
      code: "BAD_REQUEST",
      message: "timeoutMs must be a positive number when provided.",
    };
  }

  return null;
}
