"use node";

import type { RuntimeMode, SetupProgressUpdate, SetupStageState } from "@foundry/types/sandbox";
import { ConvexError, v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import { getProvider } from "../sourceControl/factory";
import type { GitHubProvider } from "../sourceControl/providers/github";
import { SETUP_PROGRESS_STAGE_NAMES } from "./validators";

const POLL_INTERVAL_MS = 5_000;
const POLL_RETRY_LIMIT = 3;
const MAX_SESSION_LIFETIME_MS = 15 * 60 * 1000;
const DEFAULT_WORKER_TIMEOUT_MS = 60_000;
const MAX_ERROR_MESSAGE_LENGTH = 4_000;
const QUEUE_DRAIN_DELAY_MS = 30_000;
const QUEUE_DRAIN_DEFAULT_LIMIT = 5;
const QUEUE_DRAIN_MAX_LIMIT = 25;

type QueuedLaunchResponse = {
  queued: true;
  queueId: string;
  queuePosition: number;
  status: "queued";
};

type QueueLaunchMode = "standard" | "subtasks" | "single_subtask";

type AuditEventType =
  | "sandbox_started"
  | "sandbox_completed"
  | "sandbox_failed"
  | "sandbox_cancelled";

/** Best-effort audit record insert. Failures are silently ignored. */
async function recordAuditEvent(
  ctx: any,
  args: {
    session: any;
    task: any;
    assignedBy: any;
    assignedByFallbackId?: any;
    eventType: AuditEventType;
    outcome: {
      status: string;
      prUrl?: string;
      prNumber?: number;
      commitSha?: string;
      filesChanged?: number;
      tokensUsed?: number;
      durationMs?: number;
      error?: string;
    };
  },
) {
  // Resolve user fields: prefer full user object, fall back to raw ID
  const userId = args.assignedBy?._id ?? args.assignedByFallbackId;
  if (!userId) return; // No user info at all — skip silently

  const userName: string = args.assignedBy?.name ?? "Unknown";
  const userClerkId: string = args.assignedBy?.clerkId ?? "";

  try {
    let skillName: string | undefined;
    if (args.session.skillId) {
      try {
        const skill = await ctx.runQuery(internalAny.skills.getInternal, {
          skillId: args.session.skillId,
        });
        if (skill) skillName = skill.name;
      } catch {
        /* ignore */
      }
    }

    await ctx.runMutation(internalAny.executionAudit.record, {
      orgId: args.session.orgId,
      programId: args.session.programId,
      taskId: args.session.taskId,
      sandboxSessionId: args.session._id,
      eventType: args.eventType,
      initiatedBy: userId,
      initiatedByName: userName,
      initiatedByClerkId: userClerkId,
      timestamp: Date.now(),
      executionStartedAt: args.session.startedAt,
      executionCompletedAt: args.session.completedAt,
      taskTitle: args.task?.title ?? "Unknown task",
      taskPrompt: args.session.taskPrompt,
      skillId: args.session.skillId,
      skillName,
      workstreamId: args.task?.workstreamId,
      environment: {
        sandboxId: args.session.sandboxId,
        worktreeBranch: args.session.worktreeBranch,
        repositoryId: args.session.repositoryId,
        executionMode: "sandbox",
      },
      outcome: args.outcome,
    });
  } catch {
    // Best effort — audit failures must never break orchestration
  }
}

type WorkerLogLevel = "info" | "stdout" | "stderr" | "system" | "error";

type WorkerLogEntry = {
  timestamp?: number | string;
  level?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

const SETUP_STAGE_NAMES = SETUP_PROGRESS_STAGE_NAMES;

type SetupProgress = SetupProgressUpdate;

type ParsedLogPoll = {
  entries: Array<{
    timestamp?: number;
    level: WorkerLogLevel;
    message: string;
    metadata?: Record<string, unknown>;
  }>;
  done: boolean;
  failed: boolean;
  nextCursor?: string;
  error?: string;
  setupProgress?: SetupProgress;
  runtimeMode?: RuntimeMode;
};

type WorkerConfig = {
  workerUrl: string;
  apiSecret: string;
};

type WorkerRequestOptions = {
  method: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
  timeoutMs?: number;
};

const internalAny: any = (generatedApi as any).internal;
const apiAny: any = (generatedApi as any).api;

async function getDesignFilesForTask(
  ctx: any,
  taskId: string,
): Promise<Record<string, string> | null> {
  try {
    const snapshot = await ctx.runQuery(internalAny.taskDesignSnapshots.getByTaskInternal, {
      taskId,
    });
    if (!snapshot) return null;

    const files: Record<string, string> = {};

    if (snapshot.resolvedTokens && snapshot.resolvedTokens !== "{}") {
      files["tokens.json"] = snapshot.resolvedTokens;
    }
    if (snapshot.resolvedComponents && snapshot.resolvedComponents !== "[]") {
      files["components.json"] = snapshot.resolvedComponents;
    }
    if (snapshot.screenSpecs) {
      files["screen-spec.md"] = snapshot.screenSpecs;
    }
    if (snapshot.interactionSpecs && snapshot.interactionSpecs !== "[]") {
      files["interactions.json"] = snapshot.interactionSpecs;
    }
    if (snapshot.codeArtifacts) {
      try {
        const artifacts = JSON.parse(snapshot.codeArtifacts);
        if (artifacts.tailwindConfig) files["tailwind.config.js"] = artifacts.tailwindConfig;
        if (artifacts.cssVariables) files["variables.css"] = artifacts.cssVariables;
        if (artifacts.scssVariables) files["_variables.scss"] = artifacts.scssVariables;
      } catch {
        // Malformed codeArtifacts — skip silently
      }
    }

    return Object.keys(files).length > 0 ? files : null;
  } catch {
    // Best effort — design file injection must never block sandbox provisioning
    return null;
  }
}

function getWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const workerUrl = env.SANDBOX_WORKER_URL?.trim();
  const apiSecret = env.SANDBOX_API_SECRET?.trim();

  if (!workerUrl || !apiSecret) {
    throw new ConvexError(
      "Sandbox worker is not configured. Set SANDBOX_WORKER_URL and SANDBOX_API_SECRET.",
    );
  }

  return { workerUrl, apiSecret };
}

function getQueueReplayToken(env: NodeJS.ProcessEnv = process.env): string {
  return env.SANDBOX_QUEUE_REPLAY_SECRET?.trim() || env.SANDBOX_API_SECRET?.trim() || "";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) return String(error.message ?? "Convex error");
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown sandbox orchestrator error";
}

function clipMessage(message: string): string {
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`;
}

async function resolveLaunchActor(
  ctx: any,
  args: {
    queueReplayToken?: string;
    queueReplayQueuedBy?: string;
  },
) {
  const replayToken = args.queueReplayToken?.trim();
  const expectedReplayToken = getQueueReplayToken();

  if (replayToken && expectedReplayToken && replayToken === expectedReplayToken) {
    if (!args.queueReplayQueuedBy) {
      throw new ConvexError("Queue replay user context is missing.");
    }
    const replayUser = await ctx.runQuery(internalAny.users.getByIdInternal, {
      userId: args.queueReplayQueuedBy,
    });
    if (!replayUser) {
      throw new ConvexError("Queued user not found for sandbox replay.");
    }
    return replayUser;
  }

  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");

  const authUser = await ctx.runQuery(apiAny.users.getByClerkId, {
    clerkId: identity.subject,
  });
  if (!authUser) throw new ConvexError("Authenticated user not found");
  return authUser;
}

function shouldQueueWorkerCreateFailure(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  if (!message) return false;

  if (message.includes("sandbox worker is not configured")) {
    return true;
  }

  const hasWorkerContext =
    message.includes("sandbox worker") ||
    message.includes("/sandbox/create") ||
    message.includes("worker request");

  if (!hasWorkerContext) return false;

  if (message.includes("request timed out") || message.includes("timed out")) {
    return true;
  }

  const outageSignals = [
    "service unavailable",
    "temporarily unavailable",
    "bad gateway",
    "gateway timeout",
    "not configured",
    "not found",
    "connection refused",
    "econnrefused",
    "econnreset",
    "etimedout",
    "ehostunreach",
    "enotfound",
    "eai_again",
    "502",
    "503",
    "504",
  ];

  return outageSignals.some((signal) => message.includes(signal));
}

function extractWorkerErrorMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  const record = asRecord(payload);
  if (!record) return null;

  const directError = typeof record.error === "string" ? record.error : undefined;
  if (directError?.trim()) return directError.trim();

  const details = asRecord(record.details);
  const detailsReason =
    details && typeof details.reason === "string" && details.reason.trim()
      ? details.reason.trim()
      : undefined;

  const nestedError = asRecord(record.error);
  if (nestedError) {
    const nestedDetails = asRecord(nestedError.details);
    const nestedReason =
      nestedDetails && typeof nestedDetails.reason === "string" && nestedDetails.reason.trim()
        ? nestedDetails.reason.trim()
        : undefined;
    if (typeof nestedError.message === "string" && nestedError.message.trim()) {
      return nestedReason
        ? `${nestedError.message.trim()}: ${nestedReason}`
        : nestedError.message.trim();
    }
    if (nestedReason) {
      return nestedReason;
    }
    if (typeof nestedError.code === "string" && nestedError.code.trim()) {
      return nestedError.code.trim();
    }
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return detailsReason ? `${record.message.trim()}: ${detailsReason}` : record.message.trim();
  }
  if (detailsReason) return detailsReason;

  return null;
}

function slugifyTitle(title: string): string {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return normalized || "task";
}

function buildWorktreeBranch(taskId: string, taskTitle: string): string {
  const idFragment = taskId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10)
    .toLowerCase();
  const slug = slugifyTitle(taskTitle).slice(0, 40).replace(/-+$/, "").replace(/^-+/, "");
  const branch = slug ? `agent/${idFragment}-${slug}` : `agent/${idFragment}`;
  return branch.replace(/-+$/, "");
}

function buildSandboxId(orgId: string, taskId: string): string {
  const orgFragment = orgId
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 24);
  const idFragment = taskId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10)
    .toLowerCase();
  const nonce = Date.now().toString(36);
  return `${orgFragment}-${idFragment}-${nonce}`;
}

function buildTaskPrompt(task: any, promptOverride?: string): string {
  const provided = promptOverride?.trim();
  if (provided) return provided;

  const sections = [
    `Task: ${task.title}`,
    task.description ? `Description: ${task.description}` : undefined,
    task.requirementTitle ? `Requirement: ${task.requirementTitle}` : undefined,
    "Implement the task end-to-end, run relevant tests, and prepare changes for PR review.",
  ].filter(Boolean);

  return sections.join("\n\n");
}

function normalizeLogLevel(level: string | undefined): WorkerLogLevel {
  switch ((level ?? "").toLowerCase()) {
    case "stdout":
      return "stdout";
    case "stderr":
      return "stderr";
    case "error":
      return "error";
    case "system":
      return "system";
    default:
      return "info";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function parseWorkerLogEntry(value: unknown): ParsedLogPoll["entries"][number] | null {
  if (typeof value === "string") {
    const message = value.trim();
    if (!message) return null;
    return { level: "stdout", message };
  }

  const record = asRecord(value);
  if (!record) return null;

  const messageSource =
    (typeof record.message === "string" && record.message) ||
    (typeof record.text === "string" && record.text) ||
    (typeof record.output === "string" && record.output) ||
    (typeof record.data === "string" && record.data);

  if (!messageSource) return null;

  const metadata = asRecord(record.metadata) ?? undefined;

  return {
    timestamp: parseTimestamp(record.timestamp),
    level: normalizeLogLevel(typeof record.level === "string" ? record.level : undefined),
    message: messageSource,
    metadata,
  };
}

function parseRuntimeMode(value: unknown): RuntimeMode | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "idle" ||
    normalized === "executing" ||
    normalized === "interactive" ||
    normalized === "hibernating"
  ) {
    return normalized;
  }
  return undefined;
}

function parseSetupStageState(value: unknown): SetupStageState | undefined {
  const record = asRecord(value);
  if (!record || typeof record.status !== "string") return undefined;

  switch (record.status) {
    case "pending":
      return { status: "pending" };
    case "running": {
      const startedAt = parseTimestamp(record.startedAt);
      if (startedAt === undefined) return undefined;
      return { status: "running", startedAt };
    }
    case "completed": {
      const startedAt = parseTimestamp(record.startedAt);
      const completedAt = parseTimestamp(record.completedAt);
      if (startedAt === undefined || completedAt === undefined) return undefined;
      return { status: "completed", startedAt, completedAt };
    }
    case "failed": {
      const startedAt = parseTimestamp(record.startedAt);
      const failedAt = parseTimestamp(record.failedAt);
      const error = typeof record.error === "string" ? record.error.trim() : "";
      if (startedAt === undefined || failedAt === undefined || !error) return undefined;
      return { status: "failed", startedAt, failedAt, error };
    }
    case "skipped": {
      const reason = typeof record.reason === "string" ? record.reason.trim() : "";
      if (!reason) return undefined;
      const skippedAt = parseTimestamp(record.skippedAt);
      return skippedAt === undefined
        ? { status: "skipped", reason }
        : { status: "skipped", reason, skippedAt };
    }
    default:
      return undefined;
  }
}

function parseSetupProgress(value: unknown): SetupProgress | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const parsed: SetupProgress = {};
  for (const stage of SETUP_STAGE_NAMES) {
    const state = parseSetupStageState(record[stage]);
    if (state) {
      parsed[stage] = state;
    }
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function extractLifecycleMetadata(
  value: unknown,
): Pick<ParsedLogPoll, "setupProgress" | "runtimeMode"> {
  const record = asRecord(value);
  if (!record) return {};

  const setupProgress = parseSetupProgress(record.setupProgress);
  const runtimeMode = parseRuntimeMode(record.runtimeMode);
  return {
    ...(setupProgress ? { setupProgress } : {}),
    ...(runtimeMode ? { runtimeMode } : {}),
  };
}

function parseSseLogPayload(payload: string): ParsedLogPoll {
  const events: unknown[] = [];
  let done = false;
  let failed = false;
  let error: string | undefined;
  let nextCursor: string | undefined;
  let setupProgress: SetupProgress | undefined;
  let runtimeMode: RuntimeMode | undefined;
  let buffer: string[] = [];

  const flushBuffer = () => {
    if (buffer.length === 0) return;
    const dataString = buffer.join("\n").trim();
    buffer = [];
    if (!dataString) return;

    let parsed: unknown = dataString;
    try {
      parsed = JSON.parse(dataString);
    } catch {
      parsed = dataString;
    }

    const parsedRecord = asRecord(parsed);
    if (parsedRecord) {
      const lifecycleCandidates = [parsedRecord, parsedRecord.event, parsedRecord.log];
      for (const candidate of lifecycleCandidates) {
        const lifecycle = extractLifecycleMetadata(candidate);
        if (lifecycle.setupProgress) {
          setupProgress = lifecycle.setupProgress;
        }
        if (lifecycle.runtimeMode) {
          runtimeMode = lifecycle.runtimeMode;
        }
      }

      const maybeDone = parsedRecord.done ?? parsedRecord.complete ?? parsedRecord.finished;
      if (maybeDone === true) done = true;

      if (parsedRecord.failed === true || parsedRecord.error !== undefined) {
        failed = true;
      }

      if (typeof parsedRecord.error === "string" && parsedRecord.error.trim()) {
        error = parsedRecord.error;
      }

      const candidateCursor =
        typeof parsedRecord.nextCursor === "string"
          ? parsedRecord.nextCursor
          : typeof parsedRecord.cursor === "string"
            ? parsedRecord.cursor
            : undefined;
      if (candidateCursor) nextCursor = candidateCursor;

      if (parsedRecord.event !== undefined) events.push(parsedRecord.event);
      if (parsedRecord.log !== undefined) events.push(parsedRecord.log);
      if (parsedRecord.message !== undefined) events.push(parsedRecord);
      return;
    }

    events.push(parsed);
  };

  for (const line of payload.split("\n")) {
    const trimmed = line.trimEnd();
    if (!trimmed) {
      flushBuffer();
      continue;
    }

    if (trimmed.startsWith("data:")) {
      buffer.push(trimmed.slice(5).trimStart());
    }
  }
  flushBuffer();

  const entries = events
    .map(parseWorkerLogEntry)
    .filter((entry): entry is ParsedLogPoll["entries"][number] => entry !== null);

  return {
    entries,
    done,
    failed,
    nextCursor,
    error,
    ...(setupProgress ? { setupProgress } : {}),
    ...(runtimeMode ? { runtimeMode } : {}),
  };
}

export function parseWorkerLogsPayload(payload: unknown): ParsedLogPoll {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return { entries: [], done: false, failed: false };
    }

    try {
      const parsed = JSON.parse(trimmed);
      return parseWorkerLogsPayload(parsed);
    } catch {
      return parseSseLogPayload(trimmed);
    }
  }

  if (Array.isArray(payload)) {
    const entries = payload
      .map(parseWorkerLogEntry)
      .filter((entry): entry is ParsedLogPoll["entries"][number] => entry !== null);

    let setupProgress: SetupProgress | undefined;
    let runtimeMode: RuntimeMode | undefined;
    for (const value of payload) {
      const lifecycle = extractLifecycleMetadata(value);
      if (lifecycle.setupProgress) {
        setupProgress = lifecycle.setupProgress;
      }
      if (lifecycle.runtimeMode) {
        runtimeMode = lifecycle.runtimeMode;
      }
    }

    return {
      entries,
      done: false,
      failed: false,
      ...(setupProgress ? { setupProgress } : {}),
      ...(runtimeMode ? { runtimeMode } : {}),
    };
  }

  const record = asRecord(payload);
  if (!record) {
    return { entries: [], done: false, failed: false };
  }

  const rawEntries = Array.isArray(record.entries)
    ? record.entries
    : Array.isArray(record.events)
      ? record.events
      : Array.isArray(record.logs)
        ? record.logs
        : [];

  const singleEntryCandidates = [record.log, record.event, record.entry];
  for (const candidate of singleEntryCandidates) {
    if (candidate !== undefined) rawEntries.push(candidate);
  }

  const entries = rawEntries
    .map(parseWorkerLogEntry)
    .filter((entry): entry is ParsedLogPoll["entries"][number] => entry !== null);

  const done = record.done === true || record.complete === true || record.finished === true;
  const failed = record.failed === true || record.error !== undefined;

  const nextCursor =
    typeof record.nextCursor === "string"
      ? record.nextCursor
      : typeof record.cursor === "string"
        ? record.cursor
        : undefined;

  const error =
    typeof record.error === "string"
      ? record.error
      : typeof record.errorMessage === "string"
        ? record.errorMessage
        : undefined;

  const lifecycleCandidates = [record, record.event, record.log];
  let setupProgress: SetupProgress | undefined;
  let runtimeMode: RuntimeMode | undefined;
  for (const candidate of lifecycleCandidates) {
    const lifecycle = extractLifecycleMetadata(candidate);
    if (lifecycle.setupProgress) {
      setupProgress = lifecycle.setupProgress;
    }
    if (lifecycle.runtimeMode) {
      runtimeMode = lifecycle.runtimeMode;
    }
  }

  return {
    entries,
    done,
    failed,
    nextCursor,
    error,
    ...(setupProgress ? { setupProgress } : {}),
    ...(runtimeMode ? { runtimeMode } : {}),
  };
}

async function callSandboxWorker(
  options: WorkerRequestOptions,
  deps?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch },
) {
  const { workerUrl, apiSecret } = getWorkerConfig(deps?.env);
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_WORKER_TIMEOUT_MS;

  const base = workerUrl.replace(/\/+$/, "");
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const url = new URL(`${base}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${apiSecret}`,
        Accept: "application/json, text/event-stream, text/plain",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") ?? "";
    const rawText = await response.text();
    let parsed: unknown = rawText;

    if (rawText) {
      if (contentType.includes("application/json")) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }
      } else {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }
      }
    } else {
      parsed = {};
    }

    const wrapped = asRecord(parsed);
    if (wrapped && wrapped.ok === false) {
      const message =
        (extractWorkerErrorMessage(wrapped) ??
          extractWorkerErrorMessage(wrapped.error) ??
          rawText) ||
        `HTTP ${response.status}`;
      throw new Error(
        `Sandbox worker request failed (${options.method} ${path}): ${clipMessage(message)}`,
      );
    }

    if (!response.ok) {
      const message = (extractWorkerErrorMessage(parsed) ?? rawText) || `HTTP ${response.status}`;
      throw new Error(
        `Sandbox worker request failed (${options.method} ${path}): ${clipMessage(message)}`,
      );
    }

    if (wrapped && wrapped.ok === true && "data" in wrapped) {
      return wrapped.data;
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Sandbox worker request timed out (${options.method} ${path}, ${timeoutMs}ms)`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function getRepoAndToken(ctx: any, repositoryId: string) {
  const sourceControl = internalAny.sourceControl;
  const { repo, installation } = await ctx.runQuery(
    sourceControl.mcp.queries.getRepoWithInstallation,
    { repositoryId },
  );

  const provider = getProvider(repo.providerType);
  let token = await ctx.runQuery(sourceControl.mcp.queries.getCachedToken, {
    installationId: installation.installationId,
  });

  if (!token) {
    const tokenResult = await provider.getInstallationToken(installation.installationId);
    token = tokenResult.token;
    // Note: upsertToken is an internalMutation defined in queries.ts (file naming is misleading)
    await ctx.runMutation(sourceControl.mcp.queries.upsertToken, {
      installationId: installation.installationId,
      token: tokenResult.token,
      expiresAt: tokenResult.expiresAt,
    });
  }

  (provider as GitHubProvider).setToken(token);
  return { repo, installation, token };
}

async function appendSystemLog(
  ctx: any,
  args: {
    orgId: string;
    sessionId: string;
    taskId?: string;
    level?: WorkerLogLevel;
    message: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await ctx.runMutation(internalAny.sandbox.logs.append, {
      orgId: args.orgId,
      sessionId: args.sessionId,
      taskId: args.taskId,
      level: args.level ?? "system",
      message: args.message,
      metadata: args.metadata,
      timestamp: Date.now(),
    });
  } catch {
    // Best effort only; logging failures should not break orchestration.
  }
}

async function syncSessionLifecycleMetadata(
  ctx: any,
  args: {
    orgId: string;
    sessionId: string;
    setupProgress?: SetupProgress;
    runtimeMode?: RuntimeMode;
  },
) {
  if (args.setupProgress === undefined && args.runtimeMode === undefined) {
    return;
  }

  try {
    await ctx.runMutation(internalAny.sandbox.sessions.syncLifecycleInternal, {
      orgId: args.orgId,
      sessionId: args.sessionId,
      setupProgress: args.setupProgress,
      runtimeMode: args.runtimeMode,
    });
  } catch {
    // Best effort only; lifecycle sync should not fail orchestration.
  }
}

async function markSessionFailed(ctx: any, sessionId: string, errorMessage: string) {
  const safeMessage = clipMessage(errorMessage);
  const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
    sessionId,
  });
  if (!context?.session) return;

  try {
    await ctx.runMutation(internalAny.sandbox.sessions.markFailed, {
      orgId: context.session.orgId,
      sessionId,
      error: safeMessage,
    });
  } catch {
    // Session may already be in a terminal state; ignore.
  }

  await appendSystemLog(ctx, {
    orgId: context.session.orgId,
    sessionId,
    taskId: context.session.taskId,
    level: "error",
    message: safeMessage,
  });

  // Record audit event for sandbox failure
  await recordAuditEvent(ctx, {
    session: context.session,
    task: context.task,
    assignedBy: context.assignedBy,
    assignedByFallbackId: context.session.assignedBy,
    eventType: "sandbox_failed",
    outcome: {
      status: "failed",
      error: safeMessage,
      durationMs: context.session.startedAt ? Date.now() - context.session.startedAt : undefined,
    },
  });

  // Move task back to todo so it's actionable again
  try {
    await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
      taskId: context.session.taskId,
      status: "todo",
    });
  } catch {
    // Best effort — don't block failure handling if task update fails
  }

  const taskTitle =
    (typeof context.task?.title === "string" && context.task.title) || "Sandbox task";

  try {
    await ctx.runMutation(internalAny.notifications.create, {
      orgId: context.session.orgId,
      userId: context.session.assignedBy,
      programId: context.session.programId,
      type: "sandbox_failed",
      title: `Agent failed: ${taskTitle}`,
      body: safeMessage,
      entityType: "sandboxSession",
      entityId: String(sessionId),
      link: `/${context.session.programId}/tasks/${context.session.taskId}`,
    });
  } catch {
    // Best effort only.
  }

  // Destroy the container after failure
  await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.cleanup, {
    sessionId,
  });
}

async function _scheduleCleanup(ctx: any, sessionId: string) {
  await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.cleanup, {
    sessionId,
  });
}

async function enqueueLaunchFallback(
  ctx: any,
  args: {
    orgId: string;
    taskId: string;
    sessionId?: string;
    queueConfig: Record<string, unknown>;
    fallbackError: unknown;
  },
): Promise<QueuedLaunchResponse> {
  const fallbackReason = clipMessage(toErrorMessage(args.fallbackError));
  const queueId = await ctx.runMutation(apiAny.sandbox.queue.enqueue, {
    orgId: args.orgId,
    taskId: args.taskId,
    config: {
      ...args.queueConfig,
      fallbackReason,
      queuedAt: Date.now(),
    },
  });

  await ctx.scheduler.runAfter(QUEUE_DRAIN_DELAY_MS, internalAny.sandbox.orchestrator.drainQueue, {
    orgId: args.orgId,
  });

  let queuePosition = 1;
  try {
    const queuedEntries = await ctx.runQuery(internalAny.sandbox.queue.listQueuedInternal, {
      orgId: args.orgId,
    });
    const index = (queuedEntries as any[]).findIndex(
      (entry) => String(entry?._id) === String(queueId),
    );
    queuePosition = index >= 0 ? index + 1 : Math.max(1, (queuedEntries as any[]).length);
  } catch {
    // Best effort only; fallback still succeeds even without precise queue position.
  }

  if (args.sessionId) {
    try {
      await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
        orgId: args.orgId,
        sessionId: args.sessionId,
        status: "cancelled",
      });
    } catch {
      // Session may already be terminal.
    }

    await appendSystemLog(ctx, {
      orgId: args.orgId,
      sessionId: args.sessionId,
      taskId: args.taskId,
      level: "system",
      message: `Sandbox launch queued due to temporary infrastructure outage (position ${queuePosition}).`,
      metadata: {
        queueId: String(queueId),
        queuePosition,
        fallbackReason,
      },
    });
  }

  return {
    queued: true,
    queueId: String(queueId),
    queuePosition,
    status: "queued",
  };
}

function parseQueueLaunchMode(value: unknown): QueueLaunchMode {
  if (value === "standard" || value === "subtasks" || value === "single_subtask") {
    return value;
  }
  return "standard";
}

function toPositiveQueueLimit(limit?: number): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return QUEUE_DRAIN_DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(Math.floor(limit), QUEUE_DRAIN_MAX_LIMIT));
}

export const drainQueue = internalAction({
  args: {
    orgId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = toPositiveQueueLimit(args.limit);
    const replayToken = getQueueReplayToken();
    if (!replayToken) {
      const remaining = await ctx.runQuery(internalAny.sandbox.queue.listQueuedInternal, {
        orgId: args.orgId,
        limit: 1,
      });
      const remainingQueued = Array.isArray(remaining) && remaining.length > 0;
      if (remainingQueued) {
        await ctx.scheduler.runAfter(
          QUEUE_DRAIN_DELAY_MS,
          internalAny.sandbox.orchestrator.drainQueue,
          {
            orgId: args.orgId,
            limit,
          },
        );
      }
      return {
        processed: 0,
        completed: 0,
        failed: 0,
        requeued: 0,
        remainingQueued,
      };
    }

    let processed = 0;
    let completed = 0;
    let failed = 0;
    let requeued = 0;

    for (let i = 0; i < limit; i += 1) {
      const queueId = await ctx.runMutation(internalAny.sandbox.queue.dequeueNextInternal, {
        orgId: args.orgId,
      });
      if (!queueId) break;

      const queueItem = await ctx.runQuery(internalAny.sandbox.queue.getInternal, {
        queueId,
      });
      if (!queueItem) continue;

      const config = asRecord(queueItem.config) ?? {};
      const launchMode = parseQueueLaunchMode(config.launchMode);
      const repositoryId = typeof config.repositoryId === "string" ? config.repositoryId : null;

      if (!repositoryId) {
        await ctx.runMutation(internalAny.sandbox.queue.markInternal, {
          queueId,
          status: "failed",
          error: "Queue item is missing repositoryId.",
          processedAt: Date.now(),
        });
        failed += 1;
        processed += 1;
        continue;
      }

      const replayArgs: Record<string, unknown> = {
        taskId: queueItem.taskId,
        repositoryId,
        queueReplayToken: replayToken,
        queueReplayQueuedBy: queueItem.queuedBy,
        suppressQueueFallback: true,
      };

      if (typeof config.taskPrompt === "string" && config.taskPrompt.trim()) {
        replayArgs.taskPrompt = config.taskPrompt;
      }
      if (typeof config.skillId === "string" && config.skillId.trim()) {
        replayArgs.skillId = config.skillId;
      }
      if (typeof config.ttlMinutes === "number" && Number.isFinite(config.ttlMinutes)) {
        replayArgs.ttlMinutes = config.ttlMinutes;
      }
      if (
        config.editorType === "monaco" ||
        config.editorType === "codemirror" ||
        config.editorType === "none"
      ) {
        replayArgs.editorType = config.editorType;
      }
      if (
        config.authProvider === "anthropic" ||
        config.authProvider === "bedrock" ||
        config.authProvider === "vertex" ||
        config.authProvider === "azure"
      ) {
        replayArgs.authProvider = config.authProvider;
      }
      if (typeof config.presetId === "string" && config.presetId.trim()) {
        replayArgs.presetId = config.presetId;
      }
      if (Array.isArray(config.mcpServerOverrides)) {
        replayArgs.mcpServerOverrides = config.mcpServerOverrides.filter(
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
        );
      }

      try {
        if (launchMode === "subtasks") {
          const subtaskIds = Array.isArray(config.subtaskIds)
            ? config.subtaskIds.filter(
                (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
              )
            : [];
          if (subtaskIds.length > 0) {
            replayArgs.subtaskIds = subtaskIds;
          }
          await ctx.runAction(apiAny.sandbox.orchestrator.startSubtaskExecution, replayArgs as any);
        } else if (launchMode === "single_subtask") {
          const subtaskId = typeof config.subtaskId === "string" ? config.subtaskId : "";
          if (!subtaskId) {
            throw new Error("Queue item is missing subtaskId.");
          }
          await ctx.runAction(apiAny.sandbox.orchestrator.executeSingleSubtask, {
            ...replayArgs,
            subtaskId,
          } as any);
        } else {
          await ctx.runAction(apiAny.sandbox.orchestrator.start, replayArgs as any);
        }

        await ctx.runMutation(internalAny.sandbox.queue.markInternal, {
          queueId,
          status: "completed",
          processedAt: Date.now(),
        });
        completed += 1;
        processed += 1;
      } catch (error) {
        const message = clipMessage(toErrorMessage(error));
        if (shouldQueueWorkerCreateFailure(error)) {
          await ctx.runMutation(internalAny.sandbox.queue.markInternal, {
            queueId,
            status: "queued",
            error: message,
          });
          requeued += 1;
          processed += 1;
          break;
        }

        await ctx.runMutation(internalAny.sandbox.queue.markInternal, {
          queueId,
          status: "failed",
          error: message,
          processedAt: Date.now(),
        });
        failed += 1;
        processed += 1;
      }
    }

    const remaining = await ctx.runQuery(internalAny.sandbox.queue.listQueuedInternal, {
      orgId: args.orgId,
      limit: 1,
    });
    const remainingQueued = Array.isArray(remaining) && remaining.length > 0;
    if (remainingQueued) {
      await ctx.scheduler.runAfter(
        QUEUE_DRAIN_DELAY_MS,
        internalAny.sandbox.orchestrator.drainQueue,
        {
          orgId: args.orgId,
          limit,
        },
      );
    }

    return {
      processed,
      completed,
      failed,
      requeued,
      remainingQueued,
    };
  },
});

/**
 * Provision and start a cloud sandbox session for a task. Handles container
 * provisioning, git clone, dependency install, and health check.
 */
export const start = action({
  args: {
    taskId: v.id("tasks"),
    repositoryId: v.id("sourceControlRepositories"),
    taskPrompt: v.optional(v.string()),
    skillId: v.optional(v.id("skills")),
    editorType: v.optional(
      v.union(v.literal("monaco"), v.literal("codemirror"), v.literal("none")),
    ),
    ttlMinutes: v.optional(v.number()),
    authProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("bedrock"),
        v.literal("vertex"),
        v.literal("azure"),
      ),
    ),
    model: v.optional(v.string()),
    presetId: v.optional(v.id("sandboxPresets")),
    mcpServerOverrides: v.optional(v.array(v.string())),
    queueReplayToken: v.optional(v.string()),
    queueReplayQueuedBy: v.optional(v.id("users")),
    suppressQueueFallback: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await resolveLaunchActor(ctx, args as any);
    const task = await ctx.runQuery(apiAny.tasks.get, { taskId: args.taskId });

    // Gate check — enforce plan/trial session limits
    const gateResult = await ctx.runQuery(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: task.orgId,
      resource: "sandbox_session",
    });
    if (!gateResult.allowed) {
      throw new ConvexError({
        code: "PLAN_LIMIT_EXCEEDED",
        resource: "sandbox_session",
        current: gateResult.currentCount,
        limit: gateResult.limit,
        reason: gateResult.reason,
      });
    }
    // gateResult.isOverage means the session will be billed at overage rate

    const { repo, token } = await getRepoAndToken(ctx, args.repositoryId as string);

    if (repo.orgId !== task.orgId || repo.programId !== task.programId) {
      throw new ConvexError("Repository does not belong to the task's organization/program");
    }

    const existingBranch = (task as any).worktreeBranch;
    const worktreeBranch = existingBranch || buildWorktreeBranch(String(task._id), task.title);
    const provisionalSandboxId = buildSandboxId(task.orgId, String(task._id));
    const taskPrompt = buildTaskPrompt(task, args.taskPrompt);

    let sessionId: string | undefined;
    try {
      sessionId = await ctx.runMutation(internalAny.sandbox.sessions.create, {
        orgId: task.orgId,
        programId: task.programId,
        taskId: task._id,
        repositoryId: repo._id,
        sandboxId: provisionalSandboxId,
        worktreeBranch,
        status: "provisioning",
        taskPrompt,
        skillId: args.skillId,
        assignedBy: authUser._id,
        editorType: args.editorType,
        ttlMinutes: args.ttlMinutes,
        authProvider: args.authProvider,
        model: args.model,
        presetId: args.presetId,
        runtimeMode: "idle",
      });

      // Increment trial session counter if org is in trial
      try {
        await ctx.runMutation(internalAny.billing.trial.incrementTrialSession, {
          orgId: task.orgId,
        });
      } catch {
        // No trial or already at limit — ignore (gate check already passed)
      }

      // Persist worktree branch on task for reuse across sessions
      if (!existingBranch) {
        try {
          await ctx.runMutation(internalAny.tasks.setWorktreeBranch, {
            taskId: args.taskId,
            worktreeBranch,
          });
        } catch {
          /* best effort */
        }
      }

      await appendSystemLog(ctx, {
        orgId: task.orgId,
        sessionId: sessionId as string,
        taskId: args.taskId,
        message: "Provisioning sandbox environment",
      });

      // Worker returns 202 immediately; provisioning runs in background.
      // The orchestrator polls logs to track progress.
      const designFiles = await getDesignFilesForTask(ctx, String(task._id));
      let createResponse: unknown;
      try {
        createResponse = await callSandboxWorker({
          method: "POST",
          path: "/sandbox/create",
          body: {
            sandboxId: provisionalSandboxId,
            repoUrl: repo.repoFullName,
            branch: repo.defaultBranch,
            worktreeBranch,
            githubToken: token,
            keepAlive: true,
            sleepAfter: `${Math.max(5, Math.min(args.ttlMinutes ?? 15, 60))}m`,
            ttlMinutes: args.ttlMinutes,
            ...(designFiles ? { designFiles } : {}),
          },
          timeoutMs: 30_000, // only needs to register the session, not finish provisioning
        });
      } catch (createError) {
        if (shouldQueueWorkerCreateFailure(createError)) {
          if (args.suppressQueueFallback) throw createError;
          return await enqueueLaunchFallback(ctx, {
            orgId: task.orgId,
            taskId: args.taskId,
            sessionId,
            queueConfig: {
              launchMode: "standard",
              repositoryId: args.repositoryId,
              taskPrompt,
              skillId: args.skillId,
              editorType: args.editorType,
              ttlMinutes: args.ttlMinutes,
              authProvider: args.authProvider,
              presetId: args.presetId,
              mcpServerOverrides: args.mcpServerOverrides,
              worktreeBranch,
              provisionalSandboxId,
            },
            fallbackError: createError,
          });
        }
        throw createError;
      }

      const createRecord = asRecord(createResponse);
      const workerSandboxId =
        typeof createRecord?.sandboxId === "string" && createRecord.sandboxId
          ? createRecord.sandboxId
          : provisionalSandboxId;
      const createLifecycle = parseWorkerLogsPayload(createResponse);

      await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
        orgId: task.orgId,
        sessionId,
        status: "cloning",
        sandboxId: workerSandboxId,
      });
      await syncSessionLifecycleMetadata(ctx, {
        orgId: task.orgId,
        sessionId: String(sessionId),
        setupProgress: createLifecycle.setupProgress,
        runtimeMode: createLifecycle.runtimeMode,
      });

      await appendSystemLog(ctx, {
        orgId: task.orgId,
        sessionId: sessionId as string,
        taskId: args.taskId,
        message: "Sandbox accepted; container provisioning in progress",
        metadata: { sandboxId: workerSandboxId, worktreeBranch },
      });

      // Move task to in_progress now that sandbox is provisioning
      try {
        await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
          taskId: args.taskId,
          status: "in_progress",
        });
      } catch {
        // Best effort — don't block sandbox start if task update fails
      }

      // Record audit event for sandbox start
      await recordAuditEvent(ctx, {
        session: {
          _id: sessionId,
          orgId: task.orgId,
          programId: task.programId,
          taskId: task._id,
          sandboxId: workerSandboxId,
          worktreeBranch,
          taskPrompt,
          skillId: args.skillId,
          repositoryId: args.repositoryId,
          startedAt: Date.now(),
        },
        task,
        assignedBy: authUser,
        eventType: "sandbox_started",
        outcome: { status: "cloning" },
      });

      await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.execute, {
        sessionId,
      });

      return {
        sessionId,
        sandboxId: workerSandboxId,
        worktreeBranch,
        status: "cloning" as const,
      };
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (sessionId) {
        await markSessionFailed(ctx, sessionId, errorMessage);
      }
      throw new ConvexError(errorMessage);
    }
  },
});

/**
 * Start a local sandbox session that runs on the developer's machine
 * instead of a cloud container.
 */
export const startLocal = action({
  args: {
    taskId: v.id("tasks"),
    repositoryId: v.optional(v.id("sourceControlRepositories")),
    taskPrompt: v.optional(v.string()),
    skillId: v.optional(v.id("skills")),
    editorType: v.optional(
      v.union(v.literal("monaco"), v.literal("codemirror"), v.literal("none")),
    ),
    ttlMinutes: v.optional(v.number()),
    authProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("bedrock"),
        v.literal("vertex"),
        v.literal("azure"),
      ),
    ),
    model: v.optional(v.string()),
    presetId: v.optional(v.id("sandboxPresets")),
    localDeviceId: v.string(),
    localDeviceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const authUser = await ctx.runQuery(apiAny.users.getByClerkId, {
      clerkId: identity.subject,
    });
    if (!authUser) throw new ConvexError("Authenticated user not found");

    const task = await ctx.runQuery(apiAny.tasks.get, { taskId: args.taskId });
    if (!authUser.orgIds.includes(task.orgId)) {
      throw new ConvexError("Access denied");
    }

    // Gate check — enforce plan/trial session limits
    const gateResult = await ctx.runQuery(internalAny.billing.gates.checkPlanLimitsQuery, {
      orgId: task.orgId,
      resource: "sandbox_session",
    });
    if (!gateResult.allowed) {
      throw new ConvexError({
        code: "PLAN_LIMIT_EXCEEDED",
        resource: "sandbox_session",
        current: gateResult.currentCount,
        limit: gateResult.limit,
        reason: gateResult.reason,
      });
    }

    if (args.repositoryId) {
      const repo = await ctx.runQuery(internalAny.sourceControl.repositories.getByIdInternal, {
        repositoryId: args.repositoryId,
      });
      if (!repo) throw new ConvexError("Repository not found");
      if (repo.orgId !== task.orgId || repo.programId !== task.programId) {
        throw new ConvexError("Repository does not belong to the task's organization/program");
      }
    }

    const existingBranch = (task as any).worktreeBranch;
    const worktreeBranch = existingBranch || buildWorktreeBranch(String(task._id), task.title);
    const localSandboxId = `local-${buildSandboxId(task.orgId, String(task._id))}`;
    const taskPrompt = buildTaskPrompt(task, args.taskPrompt);

    let sessionId: string | undefined;
    try {
      sessionId = await ctx.runMutation(internalAny.sandbox.sessions.create, {
        orgId: task.orgId,
        programId: task.programId,
        taskId: task._id,
        repositoryId: args.repositoryId,
        runtime: "local",
        localDeviceId: args.localDeviceId,
        localDeviceName: args.localDeviceName,
        sandboxId: localSandboxId,
        worktreeBranch,
        status: "executing",
        taskPrompt,
        skillId: args.skillId,
        assignedBy: authUser._id,
        editorType: args.editorType,
        ttlMinutes: args.ttlMinutes,
        authProvider: args.authProvider,
        model: args.model,
        presetId: args.presetId,
        runtimeMode: "executing",
      });

      // Increment trial session counter if org is in trial
      try {
        await ctx.runMutation(internalAny.billing.trial.incrementTrialSession, {
          orgId: task.orgId,
        });
      } catch {
        // No trial or already at limit — ignore (gate check already passed)
      }

      if (!existingBranch) {
        try {
          await ctx.runMutation(internalAny.tasks.setWorktreeBranch, {
            taskId: args.taskId,
            worktreeBranch,
          });
        } catch {
          /* best effort */
        }
      }

      try {
        await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
          taskId: args.taskId,
          status: "in_progress",
        });
      } catch {
        // Best effort — don't fail local start if task update fails
      }

      await appendSystemLog(ctx, {
        orgId: task.orgId,
        sessionId: sessionId as string,
        taskId: args.taskId,
        message: "Started local runtime sandbox session",
        metadata: {
          runtime: "local",
          localDeviceId: args.localDeviceId,
          localDeviceName: args.localDeviceName,
          worktreeBranch,
        },
      });

      await recordAuditEvent(ctx, {
        session: {
          _id: sessionId,
          orgId: task.orgId,
          programId: task.programId,
          taskId: task._id,
          sandboxId: localSandboxId,
          worktreeBranch,
          taskPrompt,
          skillId: args.skillId,
          repositoryId: args.repositoryId,
          startedAt: Date.now(),
        },
        task,
        assignedBy: authUser,
        eventType: "sandbox_started",
        outcome: { status: "executing" },
      });

      return {
        sessionId,
        sandboxId: localSandboxId,
        worktreeBranch,
        status: "executing" as const,
        runtime: "local" as const,
      };
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (sessionId) {
        await markSessionFailed(ctx, sessionId, errorMessage);
      }
      throw new ConvexError(errorMessage);
    }
  },
});

export const reportLocalCompletion = action({
  args: {
    sessionId: v.id("sandboxSessions"),
    status: v.optional(v.union(v.literal("completed"), v.literal("failed"))),
    localDeviceId: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.number()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const authUser = await ctx.runQuery(apiAny.users.getByClerkId, {
      clerkId: identity.subject,
    });
    if (!authUser) throw new ConvexError("Authenticated user not found");

    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) throw new ConvexError("Sandbox session not found");
    if (!authUser.orgIds.includes(context.session.orgId)) {
      throw new ConvexError("Access denied");
    }
    if ((context.session.runtime ?? "cloud") !== "local") {
      throw new ConvexError("reportLocalCompletion is only supported for local runtime sessions");
    }
    if (
      args.localDeviceId &&
      context.session.localDeviceId &&
      args.localDeviceId !== context.session.localDeviceId
    ) {
      throw new ConvexError("Local device mismatch for sandbox session");
    }

    if (args.status === "completed" && args.error) {
      throw new ConvexError("Completed local sessions cannot include an error payload");
    }

    const completionError =
      args.status === "failed" ? (args.error ?? "Local runtime reported failure") : args.error;

    await appendSystemLog(ctx, {
      orgId: context.session.orgId,
      sessionId: args.sessionId,
      taskId: context.session.taskId,
      level: completionError ? "error" : "system",
      message: completionError
        ? "Local runtime reported failure"
        : "Local runtime reported completion",
      metadata: {
        status: args.status ?? (completionError ? "failed" : "completed"),
        localDeviceId: args.localDeviceId ?? context.session.localDeviceId,
      },
    });

    await ctx.runAction(internalAny.sandbox.orchestrator.completeSession, {
      sessionId: args.sessionId,
      commitSha: args.commitSha,
      filesChanged: args.filesChanged,
      prUrl: args.prUrl,
      prNumber: args.prNumber,
      tokensUsed: args.tokensUsed,
      error: completionError,
    });

    const updated = await ctx.runQuery(internalAny.sandbox.sessions.getInternal, {
      sessionId: args.sessionId,
    });

    return {
      sessionId: args.sessionId,
      status: updated?.status ?? "unknown",
    };
  },
});

export const execute = internalAction({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    if (["completed", "failed", "cancelled"].includes(context.session.status)) {
      return;
    }

    try {
      const sandboxId = context.session.sandboxId;

      // Re-fetch GitHub token for the worker (not stored on session record)
      let githubToken: string | undefined;
      if (context.session.repositoryId) {
        try {
          const { token } = await getRepoAndToken(ctx, context.session.repositoryId);
          githubToken = token;
        } catch {
          // Best effort — execution may still work without push access
        }
      }

      await appendSystemLog(ctx, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        taskId: context.session.taskId,
        message: "Starting sandbox task execution",
      });

      // The SessionStore DO handles provisioning state internally.
      // If the sandbox is still provisioning, the DO waits until ready
      // before starting execution. No polling loop needed here.
      // Status is updated to "executing" AFTER the worker confirms readiness
      // to avoid prematurely transitioning from "cloning" (SB-011).
      const executeResponse = await callSandboxWorker({
        method: "POST",
        path: `/sandbox/${encodeURIComponent(sandboxId)}/execute`,
        body: {
          taskPrompt: context.session.taskPrompt,
          skillId: context.session.skillId,
          model: context.session.model,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY,
          convexUrl: process.env.CONVEX_URL,
          hookSecret: process.env.SANDBOX_API_SECRET,
          useAgentSdk: false,
          githubToken,
        },
        timeoutMs: 330_000, // 5.5 min to allow for provisioning wait + request overhead
      });
      // Worker confirmed readiness — now update Convex session to "executing"
      try {
        await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          status: "executing",
        });
      } catch (statusErr) {
        // Re-check session — it may have been marked failed/cancelled concurrently.
        const fresh = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
          sessionId: args.sessionId,
        });
        if (fresh?.session && ["completed", "failed", "cancelled"].includes(fresh.session.status)) {
          return; // already in terminal state, nothing to do
        }
        throw statusErr;
      }

      const executeLifecycle = parseWorkerLogsPayload(executeResponse);
      await syncSessionLifecycleMetadata(ctx, {
        orgId: context.session.orgId,
        sessionId: String(args.sessionId),
        setupProgress: executeLifecycle.setupProgress,
        runtimeMode: executeLifecycle.runtimeMode,
      });

      await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.pollLogs, {
        sessionId: args.sessionId,
      });
    } catch (error) {
      const rawMessage = toErrorMessage(error);
      // Provide a clearer user-facing message when the sandbox was not found
      const userMessage = /not found/i.test(rawMessage)
        ? "Sandbox environment was not found — it may have been cleaned up. Use 'Restart Now' or 'Restart Implementation' to create a new sandbox."
        : rawMessage;
      await markSessionFailed(ctx, args.sessionId, userMessage);
    }
  },
});

export const pollLogs = internalAction({
  args: {
    sessionId: v.id("sandboxSessions"),
    cursor: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    stalePollCount: v.optional(v.number()),
    sawCompletionLog: v.optional(v.boolean()),
    completionDetectedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    if (["completed", "failed", "cancelled"].includes(context.session.status)) {
      return;
    }

    if (Date.now() - context.session.startedAt > MAX_SESSION_LIFETIME_MS) {
      await markSessionFailed(
        ctx,
        args.sessionId,
        "Sandbox session exceeded the 15-minute execution limit",
      );
      return;
    }

    try {
      const response = await callSandboxWorker({
        method: "GET",
        path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}/logs`,
        query: { cursor: args.cursor, mode: "poll" },
        timeoutMs: 15_000,
      });
      const parsed = parseWorkerLogsPayload(response);
      await syncSessionLifecycleMetadata(ctx, {
        orgId: context.session.orgId,
        sessionId: String(args.sessionId),
        setupProgress: parsed.setupProgress,
        runtimeMode: parsed.runtimeMode,
      });

      if (parsed.entries.length > 0) {
        await ctx.runMutation(internalAny.sandbox.logs.appendBatch, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: context.session.taskId,
          entries: parsed.entries.map((entry) => ({
            timestamp: entry.timestamp ?? Date.now(),
            level: entry.level,
            message: entry.message,
            metadata: entry.metadata,
          })),
        });
      }

      if (parsed.failed || parsed.error) {
        await markSessionFailed(
          ctx,
          args.sessionId,
          parsed.error ?? "Sandbox worker reported execution failure",
        );
        return;
      }

      if (parsed.done) {
        // Worker reports done — check if completion webhook already handled it
        const freshContext = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
          sessionId: args.sessionId,
        });
        if (
          freshContext?.session &&
          ["completed", "failed", "cancelled"].includes(freshContext.session.status)
        ) {
          // Webhook already completed the session — stop polling
          return;
        }
        // Webhook hasn't arrived yet — call completeSession directly as fallback
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.completeSession, {
          sessionId: args.sessionId,
        });
        return;
      }

      // Fallback completion detection: text-based + stale poll counter
      const completionInCurrentEntries = parsed.entries.some((e) =>
        /^Execution complete/i.test(e.message),
      );
      const seenCompletion = args.sawCompletionLog || completionInCurrentEntries;
      const staleCount = parsed.entries.length === 0 ? (args.stalePollCount ?? 0) + 1 : 0;

      if (seenCompletion && staleCount >= 3) {
        const detectedAt = args.completionDetectedAt ?? Date.now();

        // First time hitting fallback: log it but keep polling for done: true
        if (!args.completionDetectedAt) {
          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: context.session.taskId,
            message: `Execution completed (fallback detection after stale polls) — waiting for worker readiness`,
          });
        }

        // Hard timeout: if worker hasn't become ready in 2 min, force completeSession
        if (Date.now() - detectedAt > 120_000) {
          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: context.session.taskId,
            message: `Worker still not ready after 2min, forcing completion via completeSession`,
          });
          await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.completeSession, {
            sessionId: args.sessionId,
          });
          return;
        }

        // Keep polling — wait for done: true from worker
        await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internalAny.sandbox.orchestrator.pollLogs, {
          sessionId: args.sessionId,
          cursor: parsed.nextCursor,
          retryCount: 0,
          stalePollCount: staleCount,
          sawCompletionLog: true,
          completionDetectedAt: detectedAt,
        });
        return;
      }

      await ctx.scheduler.runAfter(POLL_INTERVAL_MS, internalAny.sandbox.orchestrator.pollLogs, {
        sessionId: args.sessionId,
        cursor: parsed.nextCursor,
        retryCount: 0,
        stalePollCount: staleCount,
        sawCompletionLog: seenCompletion,
        completionDetectedAt: args.completionDetectedAt,
      });
    } catch (error) {
      const rawMessage = toErrorMessage(error);

      // If sandbox was deleted/not found, stop polling immediately instead of retrying
      if (/not found/i.test(rawMessage)) {
        const userMessage =
          "Sandbox environment was not found — it may have been cleaned up. Use 'Restart Now' or 'Restart Implementation' to create a new sandbox.";
        await markSessionFailed(ctx, args.sessionId, userMessage);
        return;
      }

      const nextRetry = (args.retryCount ?? 0) + 1;
      if (nextRetry <= POLL_RETRY_LIMIT) {
        await appendSystemLog(ctx, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: context.session.taskId,
          level: "system",
          message: `Log polling retry ${nextRetry}/${POLL_RETRY_LIMIT}: ${rawMessage}`,
        });

        await ctx.scheduler.runAfter(nextRetry * 2_000, internalAny.sandbox.orchestrator.pollLogs, {
          sessionId: args.sessionId,
          cursor: args.cursor,
          retryCount: nextRetry,
          stalePollCount: args.stalePollCount,
          sawCompletionLog: args.sawCompletionLog,
          completionDetectedAt: args.completionDetectedAt,
        });
        return;
      }

      await markSessionFailed(ctx, args.sessionId, rawMessage);
    }
  },
});

export const finalize = internalAction({
  args: {
    sessionId: v.id("sandboxSessions"),
    retryCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    if (["completed", "failed", "cancelled"].includes(context.session.status)) {
      return;
    }

    try {
      if (context.session.status !== "finalizing") {
        await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          status: "finalizing",
        });
      }

      const finalizeResponse = await callSandboxWorker({
        method: "POST",
        path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}/finalize`,
        body: {
          taskId: String(context.session.taskId),
          programId: String(context.session.programId),
        },
      });

      const result = asRecord(finalizeResponse) ?? {};
      const finalizeLifecycle = parseWorkerLogsPayload(finalizeResponse);
      await syncSessionLifecycleMetadata(ctx, {
        orgId: context.session.orgId,
        sessionId: String(args.sessionId),
        setupProgress: finalizeLifecycle.setupProgress,
        runtimeMode: finalizeLifecycle.runtimeMode,
      });
      const prUrl = typeof result.prUrl === "string" ? result.prUrl : undefined;
      const prNumber = typeof result.prNumber === "number" ? result.prNumber : undefined;
      const commitSha = typeof result.commitSha === "string" ? result.commitSha : undefined;
      const filesChanged =
        typeof result.filesChanged === "number" ? result.filesChanged : undefined;
      const tokensUsed = typeof result.tokensUsed === "number" ? result.tokensUsed : undefined;

      await ctx.runMutation(internalAny.sandbox.sessions.markComplete, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        prUrl,
        prNumber,
        commitSha,
        filesChanged,
        tokensUsed,
      });

      // Move task to review now that execution is complete
      try {
        await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
          taskId: context.session.taskId,
          status: "review",
        });
      } catch {
        // Best effort — don't fail finalize if task update fails
      }

      // Record audit event for sandbox completion
      await recordAuditEvent(ctx, {
        session: { ...context.session, completedAt: Date.now() },
        task: context.task,
        assignedBy: context.assignedBy,
        assignedByFallbackId: context.session.assignedBy,
        eventType: "sandbox_completed",
        outcome: {
          status: "completed",
          prUrl,
          prNumber,
          commitSha,
          filesChanged,
          tokensUsed,
          durationMs: context.session.startedAt
            ? Date.now() - context.session.startedAt
            : undefined,
        },
      });

      const taskTitle =
        (typeof context.task?.title === "string" && context.task.title) || "Sandbox task";
      const prDescriptor =
        prNumber !== undefined ? `PR #${prNumber}` : prUrl ? "a pull request" : "changes";
      const filesDescriptor = filesChanged !== undefined ? ` ${filesChanged} files changed.` : "";

      await ctx.runMutation(internalAny.notifications.create, {
        orgId: context.session.orgId,
        userId: context.session.assignedBy,
        programId: context.session.programId,
        type: "sandbox_complete",
        title: `Agent finished: ${taskTitle}`,
        body: `Execution complete. ${prDescriptor} is ready.${filesDescriptor}`.trim(),
        entityType: "sandboxSession",
        entityId: String(args.sessionId),
        link: `/${context.session.programId}/tasks/${context.session.taskId}`,
      });

      if (prUrl || prNumber !== undefined) {
        await ctx.runMutation(internalAny.notifications.create, {
          orgId: context.session.orgId,
          userId: context.session.assignedBy,
          programId: context.session.programId,
          type: "pr_ready",
          title: `PR ready: ${taskTitle}`,
          body:
            prNumber !== undefined && prUrl
              ? `Review PR #${prNumber} at ${prUrl}`
              : prUrl
                ? `Review PR at ${prUrl}`
                : `PR #${prNumber} is ready for review`,
          entityType: "sandboxSession",
          entityId: String(args.sessionId),
          link: prUrl,
        });
      }

      await appendSystemLog(ctx, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        taskId: context.session.taskId,
        message: "Sandbox execution finalized successfully",
        metadata: { prUrl, prNumber, commitSha, filesChanged },
      });
    } catch (error) {
      const rawMessage = toErrorMessage(error);
      const retryCount = args.retryCount ?? 0;
      const FINALIZE_RETRY_LIMIT = 5;
      const FINALIZE_RETRY_DELAY_MS = 5_000;

      // Retry on transient errors: worker still executing, DO reset, or internal errors
      const isRetryable =
        /still executing/i.test(rawMessage) ||
        /object to be reset/i.test(rawMessage) ||
        /internal error/i.test(rawMessage);

      if (isRetryable && retryCount < FINALIZE_RETRY_LIMIT) {
        await appendSystemLog(ctx, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: context.session.taskId,
          level: "system",
          message: `Finalize failed (transient), retrying (attempt ${retryCount + 1}/${FINALIZE_RETRY_LIMIT}): ${rawMessage}`,
        });

        await ctx.scheduler.runAfter(
          FINALIZE_RETRY_DELAY_MS,
          internalAny.sandbox.orchestrator.finalize,
          {
            sessionId: args.sessionId,
            retryCount: retryCount + 1,
          },
        );
        return;
      }

      await markSessionFailed(ctx, args.sessionId, rawMessage);
    }
  },
});

/**
 * Deterministic session completion — called by the worker completion webhook
 * or as a fallback by pollLogs timeout. Replaces the finalize → worker HTTP
 * round-trip with a single, idempotent action.
 */
export const completeSession = internalAction({
  args: {
    sessionId: v.id("sandboxSessions"),
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.number()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    // Idempotent — skip if already in a terminal state
    if (["completed", "failed", "cancelled"].includes(context.session.status)) {
      return;
    }

    // If the worker reported an error, mark failed
    if (args.error) {
      await markSessionFailed(ctx, args.sessionId, args.error);
      return;
    }

    try {
      // Transition through finalizing if still executing (state machine requires it)
      if (context.session.status === "executing") {
        await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          status: "finalizing",
        });
      }

      await ctx.runMutation(internalAny.sandbox.sessions.markComplete, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        prUrl: args.prUrl,
        prNumber: args.prNumber,
        commitSha: args.commitSha,
        filesChanged: args.filesChanged,
        tokensUsed: args.tokensUsed,
      });

      // Destroy the container now that session is complete
      await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.cleanup, {
        sessionId: args.sessionId,
      });

      // Move task to review
      try {
        await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
          taskId: context.session.taskId,
          status: "review",
        });
      } catch {
        // Best effort — don't fail completion if task update fails
      }

      // Record audit event
      await recordAuditEvent(ctx, {
        session: { ...context.session, completedAt: Date.now() },
        task: context.task,
        assignedBy: context.assignedBy,
        assignedByFallbackId: context.session.assignedBy,
        eventType: "sandbox_completed",
        outcome: {
          status: "completed",
          prUrl: args.prUrl,
          prNumber: args.prNumber,
          commitSha: args.commitSha,
          filesChanged: args.filesChanged,
          tokensUsed: args.tokensUsed,
          durationMs: context.session.startedAt
            ? Date.now() - context.session.startedAt
            : undefined,
        },
      });

      // Notifications
      const taskTitle =
        (typeof context.task?.title === "string" && context.task.title) || "Sandbox task";
      const prDescriptor =
        args.prNumber !== undefined
          ? `PR #${args.prNumber}`
          : args.prUrl
            ? "a pull request"
            : "changes";
      const filesDescriptor =
        args.filesChanged !== undefined ? ` ${args.filesChanged} files changed.` : "";

      await ctx.runMutation(internalAny.notifications.create, {
        orgId: context.session.orgId,
        userId: context.session.assignedBy,
        programId: context.session.programId,
        type: "sandbox_complete",
        title: `Agent finished: ${taskTitle}`,
        body: `Execution complete. ${prDescriptor} is ready.${filesDescriptor}`.trim(),
        entityType: "sandboxSession",
        entityId: String(args.sessionId),
        link: `/${context.session.programId}/tasks/${context.session.taskId}`,
      });

      if (args.prUrl || args.prNumber !== undefined) {
        await ctx.runMutation(internalAny.notifications.create, {
          orgId: context.session.orgId,
          userId: context.session.assignedBy,
          programId: context.session.programId,
          type: "pr_ready",
          title: `PR ready: ${taskTitle}`,
          body:
            args.prNumber !== undefined && args.prUrl
              ? `Review PR #${args.prNumber} at ${args.prUrl}`
              : args.prUrl
                ? `Review PR at ${args.prUrl}`
                : `PR #${args.prNumber} is ready for review`,
          entityType: "sandboxSession",
          entityId: String(args.sessionId),
          link: args.prUrl,
        });
      }

      // Trigger post-implementation verification (best effort)
      try {
        await ctx.scheduler.runAfter(0, internalAny.taskVerificationActions.triggerVerification, {
          taskId: context.session.taskId,
          sandboxSessionId: args.sessionId,
          triggeredBy: context.session.assignedBy,
          trigger: "automatic" as const,
          commitSha: args.commitSha,
          prUrl: args.prUrl,
          prNumber: args.prNumber,
          branch: context.session.worktreeBranch,
        });
      } catch {
        // Best effort — verification failure never blocks session completion
      }

      await appendSystemLog(ctx, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        taskId: context.session.taskId,
        message: "Sandbox execution completed successfully",
        metadata: {
          prUrl: args.prUrl,
          prNumber: args.prNumber,
          commitSha: args.commitSha,
          filesChanged: args.filesChanged,
        },
      });
    } catch (error) {
      await markSessionFailed(ctx, args.sessionId, toErrorMessage(error));
    }
  },
});

/** Stop a running sandbox session gracefully. */
export const stop = action({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    // Fetch context before cancelling for audit record
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });

    // 1. Cancel the session (validates access internally)
    await ctx.runMutation(apiAny.sandbox.sessions.cancel, {
      sessionId: args.sessionId,
    });

    // 2. Record audit event for cancellation
    if (context?.session) {
      // Resolve the cancelling user (may differ from assignedBy)
      const identity = await ctx.auth.getUserIdentity();
      let cancelledBy = context.assignedBy;
      if (identity) {
        const user = await ctx.runQuery(apiAny.users.getByClerkId, {
          clerkId: identity.subject,
        });
        if (user) cancelledBy = user;
      }

      await recordAuditEvent(ctx, {
        session: context.session,
        task: context.task,
        assignedBy: cancelledBy,
        assignedByFallbackId: context.session.assignedBy,
        eventType: "sandbox_cancelled",
        outcome: {
          status: "cancelled",
          durationMs: context.session.startedAt
            ? Date.now() - context.session.startedAt
            : undefined,
        },
      });
    }

    // 3. Immediately schedule container cleanup
    await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.cleanup, {
      sessionId: args.sessionId,
    });

    return { sessionId: args.sessionId };
  },
});

/** Wake a hibernated sandbox session back to active state. */
export const wake = action({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) throw new ConvexError("Sandbox session not found");

    const authUser = await ctx.runQuery(apiAny.users.getByClerkId, {
      clerkId: identity.subject,
    });
    if (!authUser) throw new ConvexError("Authenticated user not found");
    if (!authUser.orgIds.includes(context.session.orgId)) {
      throw new ConvexError("Access denied");
    }

    await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
      orgId: context.session.orgId,
      sessionId: args.sessionId,
      status: "executing",
    });

    try {
      await callSandboxWorker({
        method: "POST",
        path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}/wake`,
      });
    } catch {
      // Best effort — status already updated; log failure
    }

    await appendSystemLog(ctx, {
      orgId: context.session.orgId,
      sessionId: args.sessionId,
      taskId: context.session.taskId,
      message: "Sandbox woke from sleep",
    });

    await recordAuditEvent(ctx, {
      session: context.session,
      task: context.task,
      assignedBy: authUser,
      assignedByFallbackId: context.session.assignedBy,
      eventType: "sandbox_started",
      outcome: { status: "executing" },
    });

    return { sessionId: args.sessionId };
  },
});

/** Shut down a sandbox session and clean up its container resources. */
export const shutdown = action({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) throw new ConvexError("Sandbox session not found");

    const authUser = await ctx.runQuery(apiAny.users.getByClerkId, {
      clerkId: identity.subject,
    });
    if (!authUser) throw new ConvexError("Authenticated user not found");
    if (!authUser.orgIds.includes(context.session.orgId)) {
      throw new ConvexError("Access denied");
    }

    await ctx.runMutation(apiAny.sandbox.sessions.cancel, {
      sessionId: args.sessionId,
    });

    try {
      await callSandboxWorker({
        method: "DELETE",
        path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}`,
      });
    } catch {
      // Best effort — session already cancelled
    }

    await appendSystemLog(ctx, {
      orgId: context.session.orgId,
      sessionId: args.sessionId,
      taskId: context.session.taskId,
      message: "Sandbox shut down",
    });

    await recordAuditEvent(ctx, {
      session: context.session,
      task: context.task,
      assignedBy: authUser,
      assignedByFallbackId: context.session.assignedBy,
      eventType: "sandbox_cancelled",
      outcome: {
        status: "cancelled",
        durationMs: context.session.startedAt ? Date.now() - context.session.startedAt : undefined,
      },
    });

    return { sessionId: args.sessionId };
  },
});

export const cleanup = internalAction({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    try {
      await callSandboxWorker({
        method: "DELETE",
        path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}`,
      });

      await appendSystemLog(ctx, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        taskId: context.session.taskId,
        message: "Sandbox cleanup completed",
      });
    } catch (error) {
      const message = toErrorMessage(error);
      // If the sandbox was already deleted or never existed, treat as success
      if (/not found/i.test(message)) {
        await appendSystemLog(ctx, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: context.session.taskId,
          message: "Sandbox cleanup completed (sandbox already removed)",
        });
      } else {
        await appendSystemLog(ctx, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: context.session.taskId,
          level: "error",
          message: `Sandbox cleanup failed: ${message}`,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Subtask Execution Actions
// ---------------------------------------------------------------------------

/**
 * Start subtask-mode execution: Provisions a sandbox and runs subtasks
 * sequentially. Re-uses existing sandbox if already provisioned for the task.
 */
export const startSubtaskExecution = action({
  args: {
    taskId: v.id("tasks"),
    repositoryId: v.id("sourceControlRepositories"),
    taskPrompt: v.optional(v.string()),
    skillId: v.optional(v.id("skills")),
    subtaskIds: v.optional(v.array(v.id("subtasks"))),
    runtime: v.optional(v.union(v.literal("cloud"), v.literal("local"))),
    localDeviceId: v.optional(v.string()),
    localDeviceName: v.optional(v.string()),
    editorType: v.optional(
      v.union(v.literal("monaco"), v.literal("codemirror"), v.literal("none")),
    ),
    ttlMinutes: v.optional(v.number()),
    authProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("bedrock"),
        v.literal("vertex"),
        v.literal("azure"),
      ),
    ),
    model: v.optional(v.string()),
    presetId: v.optional(v.id("sandboxPresets")),
    mcpServerOverrides: v.optional(v.array(v.string())),
    queueReplayToken: v.optional(v.string()),
    queueReplayQueuedBy: v.optional(v.id("users")),
    suppressQueueFallback: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await resolveLaunchActor(ctx, args as any);
    const task = await ctx.runQuery(apiAny.tasks.get, { taskId: args.taskId });
    if (!(task as any).hasSubtasks) {
      throw new ConvexError("Task has no subtasks. Generate subtasks first.");
    }

    const runtime = args.runtime ?? "cloud";
    if (runtime === "local" && !args.localDeviceId) {
      throw new ConvexError("localDeviceId is required when runtime is local");
    }

    let repo: any;
    let token: string | undefined;
    if (runtime === "local") {
      repo = await ctx.runQuery(internalAny.sourceControl.repositories.getByIdInternal, {
        repositoryId: args.repositoryId,
      });
      if (!repo) throw new ConvexError("Repository not found");
    } else {
      const repoAndToken = await getRepoAndToken(ctx, args.repositoryId as string);
      repo = repoAndToken.repo;
      token = repoAndToken.token;
    }

    if (repo.orgId !== task.orgId || repo.programId !== task.programId) {
      throw new ConvexError("Repository does not belong to the task's organization/program");
    }

    const existingBranch = (task as any).worktreeBranch;
    const worktreeBranch = existingBranch || buildWorktreeBranch(String(task._id), task.title);
    const provisionalSandboxId = buildSandboxId(task.orgId, String(task._id));
    const localSandboxId = `local-${provisionalSandboxId}`;
    const taskPrompt = buildTaskPrompt(task, args.taskPrompt);

    let sessionId: string | undefined;
    try {
      sessionId = await ctx.runMutation(internalAny.sandbox.sessions.create, {
        orgId: task.orgId,
        programId: task.programId,
        taskId: task._id,
        repositoryId: repo._id,
        runtime,
        localDeviceId: args.localDeviceId,
        localDeviceName: args.localDeviceName,
        sandboxId: runtime === "local" ? localSandboxId : provisionalSandboxId,
        worktreeBranch,
        status: runtime === "local" ? "executing" : "provisioning",
        taskPrompt,
        skillId: args.skillId,
        assignedBy: authUser._id,
        executionMode: "subtask",
        editorType: args.editorType,
        ttlMinutes: args.ttlMinutes,
        authProvider: args.authProvider,
        model: args.model,
        presetId: args.presetId,
        runtimeMode: runtime === "local" ? "executing" : "idle",
      });

      // Persist worktree branch on task for reuse across sessions
      if (!existingBranch) {
        try {
          await ctx.runMutation(internalAny.tasks.setWorktreeBranch, {
            taskId: args.taskId,
            worktreeBranch,
          });
        } catch {
          /* best effort */
        }
      }

      if (runtime === "local") {
        try {
          await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
            taskId: args.taskId,
            status: "in_progress",
          });
        } catch {
          // Best effort
        }

        await appendSystemLog(ctx, {
          orgId: task.orgId,
          sessionId: sessionId as string,
          taskId: args.taskId,
          message: "Started local runtime subtask session",
          metadata: {
            runtime: "local",
            localDeviceId: args.localDeviceId,
            localDeviceName: args.localDeviceName,
            worktreeBranch,
          },
        });

        await recordAuditEvent(ctx, {
          session: {
            _id: sessionId,
            orgId: task.orgId,
            programId: task.programId,
            taskId: task._id,
            sandboxId: localSandboxId,
            worktreeBranch,
            taskPrompt,
            skillId: args.skillId,
            repositoryId: args.repositoryId,
            startedAt: Date.now(),
          },
          task,
          assignedBy: authUser,
          eventType: "sandbox_started",
          outcome: { status: "executing" },
        });

        if (args.subtaskIds && args.subtaskIds.length > 0) {
          await ctx.runMutation(internalAny.subtasks.markSubtasksSkipped, {
            taskId: args.taskId,
            excludeIds: args.subtaskIds,
          });
        }

        return {
          sessionId,
          sandboxId: localSandboxId,
          worktreeBranch,
          status: "executing" as const,
          runtime: "local" as const,
        };
      }

      await appendSystemLog(ctx, {
        orgId: task.orgId,
        sessionId: sessionId as string,
        taskId: args.taskId,
        message: "Provisioning sandbox for subtask execution",
      });

      const designFiles = await getDesignFilesForTask(ctx, String(task._id));
      let createResponse: unknown;
      try {
        createResponse = await callSandboxWorker({
          method: "POST",
          path: "/sandbox/create",
          body: {
            sandboxId: provisionalSandboxId,
            repoUrl: repo.repoFullName,
            branch: repo.defaultBranch,
            worktreeBranch,
            githubToken: token,
            keepAlive: true,
            sleepAfter: `${Math.max(5, Math.min(args.ttlMinutes ?? 15, 60))}m`,
            ttlMinutes: args.ttlMinutes,
            ...(designFiles ? { designFiles } : {}),
          },
          timeoutMs: 30_000,
        });
      } catch (createError) {
        if (shouldQueueWorkerCreateFailure(createError)) {
          if (args.suppressQueueFallback) throw createError;
          return await enqueueLaunchFallback(ctx, {
            orgId: task.orgId,
            taskId: args.taskId,
            sessionId,
            queueConfig: {
              launchMode: "subtasks",
              repositoryId: args.repositoryId,
              taskPrompt,
              skillId: args.skillId,
              subtaskIds: args.subtaskIds,
              editorType: args.editorType,
              ttlMinutes: args.ttlMinutes,
              authProvider: args.authProvider,
              presetId: args.presetId,
              mcpServerOverrides: args.mcpServerOverrides,
              worktreeBranch,
              provisionalSandboxId,
            },
            fallbackError: createError,
          });
        }
        throw createError;
      }

      const createRecord = asRecord(createResponse);
      const workerSandboxId =
        typeof createRecord?.sandboxId === "string" && createRecord.sandboxId
          ? createRecord.sandboxId
          : provisionalSandboxId;
      const createLifecycle = parseWorkerLogsPayload(createResponse);

      await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
        orgId: task.orgId,
        sessionId,
        status: "cloning",
        sandboxId: workerSandboxId,
      });
      await syncSessionLifecycleMetadata(ctx, {
        orgId: task.orgId,
        sessionId: String(sessionId),
        setupProgress: createLifecycle.setupProgress,
        runtimeMode: createLifecycle.runtimeMode,
      });

      try {
        await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
          taskId: args.taskId,
          status: "in_progress",
        });
      } catch {
        // Best effort
      }

      await recordAuditEvent(ctx, {
        session: {
          _id: sessionId,
          orgId: task.orgId,
          programId: task.programId,
          taskId: task._id,
          sandboxId: workerSandboxId,
          worktreeBranch,
          taskPrompt,
          skillId: args.skillId,
          repositoryId: args.repositoryId,
          startedAt: Date.now(),
        },
        task,
        assignedBy: authUser,
        eventType: "sandbox_started",
        outcome: { status: "cloning" },
      });

      // If specific subtaskIds provided, skip all other pending subtasks
      if (args.subtaskIds && args.subtaskIds.length > 0) {
        await ctx.runMutation(internalAny.subtasks.markSubtasksSkipped, {
          taskId: args.taskId,
          excludeIds: args.subtaskIds,
        });
      }

      // Schedule first subtask execution (not execute, but executeNextSubtask)
      await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.executeNextSubtask, {
        sessionId,
        taskId: args.taskId,
      });

      return {
        sessionId,
        sandboxId: workerSandboxId,
        worktreeBranch,
        status: "cloning" as const,
      };
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (sessionId) {
        await markSessionFailed(ctx, sessionId, errorMessage);
      }
      throw new ConvexError(errorMessage);
    }
  },
});

/**
 * Execute the next pending subtask in order. If all subtasks are done, finalize.
 */
export const executeNextSubtask = internalAction({
  args: {
    sessionId: v.id("sandboxSessions"),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    if (["completed", "failed", "cancelled"].includes(context.session.status)) return;

    try {
      // Get all subtasks ordered
      const subtasks = await ctx.runQuery(internalAny.subtasks.listByTaskInternal, {
        taskId: args.taskId,
      });

      if (!subtasks || (subtasks as any[]).length === 0) {
        // No subtasks, fall through to standard finalization
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.completeSession, {
          sessionId: args.sessionId,
        });
        return;
      }

      const subtaskList = subtasks as any[];

      // Find the next pending subtask
      const nextSubtask = subtaskList.find(
        (s: any) => s.status === "pending" || s.status === "retrying",
      );

      if (!nextSubtask) {
        // All subtasks done — check for failures
        const failed = subtaskList.filter((s: any) => s.status === "failed");
        if (failed.length > 0) {
          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: args.taskId,
            level: "system",
            message: `Subtask execution complete with ${failed.length} failure(s). ${subtaskList.filter((s: any) => s.status === "completed").length}/${subtaskList.length} completed.`,
          });
        }

        // Finalize the session
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.completeSession, {
          sessionId: args.sessionId,
        });
        return;
      }

      // Check if previous subtask was a pause point and is completed
      if (nextSubtask.order > 0) {
        const prev = subtaskList.find((s: any) => s.order === nextSubtask.order - 1);
        if (prev?.isPausePoint && prev.status === "completed") {
          // Pause here — notify user and wait
          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: args.taskId,
            level: "system",
            message: `Paused after subtask "${prev.title}" (pause point). Continue manually when ready.`,
          });

          try {
            await ctx.runMutation(internalAny.notifications.create, {
              orgId: context.session.orgId,
              userId: context.session.assignedBy,
              programId: context.session.programId,
              type: "subtask_paused",
              title: `Agent paused: ${(context.task as any)?.title ?? "Task"}`,
              body: `Paused after completing "${prev.title}". Review and continue when ready.`,
              entityType: "sandboxSession",
              entityId: String(args.sessionId),
              link: `/${context.session.programId}/tasks/${args.taskId}`,
            });
          } catch {
            // Best effort
          }
          return;
        }
      }

      // Mark subtask as executing
      await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
        subtaskId: nextSubtask._id,
        status: "executing",
      });

      // Build prior changelog from previous subtask results
      const completedSubtasks = subtaskList.filter(
        (s: any) => s.status === "completed" && s.order < nextSubtask.order,
      );
      const priorChangelog = completedSubtasks
        .map(
          (s: any) =>
            `[${s.order + 1}] ${s.title}: ${(s.filesChanged ?? []).join(", ") || "no files listed"}`,
        )
        .join("\n");

      if (priorChangelog) {
        await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
          subtaskId: nextSubtask._id,
          status: "executing",
        });
      }

      await appendSystemLog(ctx, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        taskId: args.taskId,
        message: `Executing subtask ${nextSubtask.order + 1}/${subtaskList.length}: "${nextSubtask.title}"`,
        metadata: { subtaskId: nextSubtask._id },
      });

      // Record audit event
      try {
        await recordAuditEvent(ctx, {
          session: context.session,
          task: context.task,
          assignedBy: context.assignedBy,
          assignedByFallbackId: context.session.assignedBy,
          eventType: "subtask_started" as AuditEventType,
          outcome: {
            status: "executing",
          },
        });
      } catch {
        // Best effort
      }

      // Update parent task activity
      try {
        await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
          taskId: args.taskId,
        });
      } catch {
        // Best effort
      }

      // Build the subtask-scoped prompt
      const subtaskPrompt = [
        `SUBTASK ${nextSubtask.order + 1}/${subtaskList.length}: ${nextSubtask.title}`,
        "",
        nextSubtask.prompt,
        "",
        priorChangelog ? `PRIOR CHANGES (context):\n${priorChangelog}` : "",
        nextSubtask.allowedFiles?.length
          ? `SCOPE: Only modify files matching these patterns: ${nextSubtask.allowedFiles.join(", ")}`
          : "",
        "Complete this subtask. Commit your changes when done.",
      ]
        .filter(Boolean)
        .join("\n");

      // Re-fetch GitHub token for subtask execution
      let subtaskGithubToken: string | undefined;
      if (context.session.repositoryId) {
        try {
          const { token } = await getRepoAndToken(ctx, context.session.repositoryId);
          subtaskGithubToken = token;
        } catch {
          /* best effort */
        }
      }

      // Execute in sandbox
      try {
        await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          status: "executing",
          subtaskId: nextSubtask._id,
        });
      } catch {
        // may already be executing
      }

      try {
        const executeResponse = await callSandboxWorker({
          method: "POST",
          path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}/execute`,
          body: {
            taskPrompt: subtaskPrompt,
            skillId: context.session.skillId,
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
            convexUrl: process.env.CONVEX_URL,
            hookSecret: process.env.SANDBOX_API_SECRET,
            githubToken: subtaskGithubToken,
          },
          timeoutMs: 330_000,
        });
        const executeLifecycle = parseWorkerLogsPayload(executeResponse);
        await syncSessionLifecycleMetadata(ctx, {
          orgId: context.session.orgId,
          sessionId: String(args.sessionId),
          setupProgress: executeLifecycle.setupProgress,
          runtimeMode: executeLifecycle.runtimeMode,
        });
      } catch (error) {
        // Handle execution failure for this subtask
        const rawMessage = toErrorMessage(error);
        const retryable = !/not found/i.test(rawMessage);
        const retryCount = nextSubtask.retryCount ?? 0;

        if (retryable && retryCount < 2) {
          await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
            subtaskId: nextSubtask._id,
            status: "retrying",
            errorMessage: rawMessage,
          });
          // Re-schedule
          await ctx.scheduler.runAfter(5_000, internalAny.sandbox.orchestrator.executeNextSubtask, {
            sessionId: args.sessionId,
            taskId: args.taskId,
          });
          return;
        }

        await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
          subtaskId: nextSubtask._id,
          status: "failed",
          errorMessage: rawMessage,
        });

        try {
          await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
            taskId: args.taskId,
          });
        } catch {
          /* best effort */
        }

        try {
          await ctx.runMutation(internalAny.notifications.create, {
            orgId: context.session.orgId,
            userId: context.session.assignedBy,
            programId: context.session.programId,
            type: "subtask_failed",
            title: `Subtask failed: ${nextSubtask.title}`,
            body: rawMessage.slice(0, 200),
            entityType: "sandboxSession",
            entityId: String(args.sessionId),
            link: `/${context.session.programId}/tasks/${args.taskId}`,
          });
        } catch {
          /* best effort */
        }

        // Continue to next subtask despite failure
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.executeNextSubtask, {
          sessionId: args.sessionId,
          taskId: args.taskId,
        });
        return;
      }

      // Poll logs for this subtask execution
      await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.pollSubtaskLogs, {
        sessionId: args.sessionId,
        taskId: args.taskId,
        subtaskId: nextSubtask._id,
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      await markSessionFailed(ctx, args.sessionId, errorMessage);
    }
  },
});

/**
 * Poll logs for a running subtask. When done, marks subtask complete and
 * schedules the next subtask.
 */
export const pollSubtaskLogs = internalAction({
  args: {
    sessionId: v.id("sandboxSessions"),
    taskId: v.id("tasks"),
    subtaskId: v.id("subtasks"),
    cursor: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    stalePollCount: v.optional(v.number()),
    sawCompletionLog: v.optional(v.boolean()),
    completionDetectedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    if (["completed", "failed", "cancelled"].includes(context.session.status)) return;

    // Check session lifetime
    if (Date.now() - context.session.startedAt > MAX_SESSION_LIFETIME_MS) {
      await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
        subtaskId: args.subtaskId,
        status: "failed",
        errorMessage: "Session exceeded 15-minute execution limit",
      });
      await markSessionFailed(
        ctx,
        args.sessionId,
        "Sandbox session exceeded the 15-minute execution limit",
      );
      return;
    }

    try {
      const response = await callSandboxWorker({
        method: "GET",
        path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}/logs`,
        query: { cursor: args.cursor, mode: "poll" },
        timeoutMs: 15_000,
      });
      const parsed = parseWorkerLogsPayload(response);
      await syncSessionLifecycleMetadata(ctx, {
        orgId: context.session.orgId,
        sessionId: String(args.sessionId),
        setupProgress: parsed.setupProgress,
        runtimeMode: parsed.runtimeMode,
      });

      if (parsed.entries.length > 0) {
        // Annotate logs with subtaskId
        await ctx.runMutation(internalAny.sandbox.logs.appendBatch, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: args.taskId,
          entries: parsed.entries.map((entry) => ({
            timestamp: entry.timestamp ?? Date.now(),
            level: entry.level,
            message: entry.message,
            metadata: { ...entry.metadata, subtaskId: args.subtaskId },
          })),
        });
      }

      if (parsed.failed || parsed.error) {
        // Subtask failed
        await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
          subtaskId: args.subtaskId,
          status: "failed",
          errorMessage: parsed.error ?? "Sandbox worker reported execution failure",
        });

        try {
          await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
            taskId: args.taskId,
          });
        } catch {
          /* best effort */
        }

        // Continue to next subtask
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.executeNextSubtask, {
          sessionId: args.sessionId,
          taskId: args.taskId,
        });
        return;
      }

      if (parsed.done) {
        // Subtask completed — skip updateStatusInternal if fallback already marked it
        if (!args.completionDetectedAt) {
          await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
            subtaskId: args.subtaskId,
            status: "completed",
            executionDurationMs: Date.now() - context.session.startedAt,
          });
        }

        await appendSystemLog(ctx, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: args.taskId,
          message: `Subtask completed successfully`,
          metadata: { subtaskId: args.subtaskId },
        });

        try {
          await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
            taskId: args.taskId,
          });
        } catch {
          /* best effort */
        }

        try {
          await ctx.runMutation(internalAny.notifications.create, {
            orgId: context.session.orgId,
            userId: context.session.assignedBy,
            programId: context.session.programId,
            type: "subtask_completed",
            title: `Subtask completed`,
            body: `A subtask has been completed for "${(context.task as any)?.title ?? "task"}"`,
            entityType: "sandboxSession",
            entityId: String(args.sessionId),
            link: `/${context.session.programId}/tasks/${args.taskId}`,
          });
        } catch {
          /* best effort */
        }

        // Schedule next subtask
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.executeNextSubtask, {
          sessionId: args.sessionId,
          taskId: args.taskId,
        });
        return;
      }

      // Fallback completion detection: text-based + stale poll counter
      const completionInCurrentEntries = parsed.entries.some((e) =>
        /^Execution complete/i.test(e.message),
      );
      const seenCompletion = args.sawCompletionLog || completionInCurrentEntries;
      const staleCount = parsed.entries.length === 0 ? (args.stalePollCount ?? 0) + 1 : 0;

      if (seenCompletion && staleCount >= 3) {
        const detectedAt = args.completionDetectedAt ?? Date.now();

        // First time hitting fallback: mark subtask completed, but keep polling for done: true
        if (!args.completionDetectedAt) {
          await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
            subtaskId: args.subtaskId,
            status: "completed",
            executionDurationMs: Date.now() - context.session.startedAt,
          });

          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: args.taskId,
            message: `Subtask completed (fallback detection after stale polls) — waiting for worker readiness`,
            metadata: { subtaskId: args.subtaskId },
          });

          try {
            await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
              taskId: args.taskId,
            });
          } catch {
            /* best effort */
          }
        }

        // Hard timeout: if worker hasn't become ready in 2 min, move to next subtask
        if (Date.now() - detectedAt > 120_000) {
          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: args.taskId,
            message: `Worker still not ready after 2min, moving to next subtask`,
            metadata: { subtaskId: args.subtaskId },
          });

          await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.executeNextSubtask, {
            sessionId: args.sessionId,
            taskId: args.taskId,
          });
          return;
        }

        // Keep polling — wait for done: true from worker
        await ctx.scheduler.runAfter(
          POLL_INTERVAL_MS,
          internalAny.sandbox.orchestrator.pollSubtaskLogs,
          {
            sessionId: args.sessionId,
            taskId: args.taskId,
            subtaskId: args.subtaskId,
            cursor: parsed.nextCursor,
            retryCount: 0,
            stalePollCount: staleCount,
            sawCompletionLog: true,
            completionDetectedAt: detectedAt,
          },
        );
        return;
      }

      // Continue polling
      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internalAny.sandbox.orchestrator.pollSubtaskLogs,
        {
          sessionId: args.sessionId,
          taskId: args.taskId,
          subtaskId: args.subtaskId,
          cursor: parsed.nextCursor,
          retryCount: 0,
          stalePollCount: staleCount,
          sawCompletionLog: seenCompletion,
          completionDetectedAt: args.completionDetectedAt,
        },
      );
    } catch (error) {
      const rawMessage = toErrorMessage(error);

      if (/not found/i.test(rawMessage)) {
        await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
          subtaskId: args.subtaskId,
          status: "failed",
          errorMessage: "Sandbox not found",
        });
        await markSessionFailed(ctx, args.sessionId, "Sandbox environment was not found");
        return;
      }

      const nextRetry = (args.retryCount ?? 0) + 1;
      if (nextRetry <= POLL_RETRY_LIMIT) {
        await ctx.scheduler.runAfter(
          nextRetry * 2_000,
          internalAny.sandbox.orchestrator.pollSubtaskLogs,
          {
            sessionId: args.sessionId,
            taskId: args.taskId,
            subtaskId: args.subtaskId,
            cursor: args.cursor,
            retryCount: nextRetry,
            stalePollCount: args.stalePollCount,
            sawCompletionLog: args.sawCompletionLog,
            completionDetectedAt: args.completionDetectedAt,
          },
        );
        return;
      }

      await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
        subtaskId: args.subtaskId,
        status: "failed",
        errorMessage: rawMessage,
      });
      await markSessionFailed(ctx, args.sessionId, rawMessage);
    }
  },
});

/**
 * Continue subtask execution after a pause point.
 */
export const continueAfterPause = action({
  args: {
    sessionId: v.optional(v.id("sandboxSessions")),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    // Resolve sessionId: use provided value or look up the latest session for this task.
    let sessionId = args.sessionId;
    if (!sessionId) {
      const session = await ctx.runQuery(apiAny.sandbox.sessions.getByTask, {
        taskId: args.taskId,
      });
      if (!session) throw new ConvexError("No active session found for task");
      sessionId = session._id;
    }
    if (!sessionId) throw new ConvexError("No active session found for task");

    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId,
    });
    if (!context?.session) throw new ConvexError("Session not found");

    await appendSystemLog(ctx, {
      orgId: context.session.orgId,
      sessionId,
      taskId: args.taskId,
      message: "Continuing execution after pause point",
    });

    await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.executeNextSubtask, {
      sessionId,
      taskId: args.taskId,
    });

    return { continued: true };
  },
});

/**
 * Retry a failed subtask by resetting its status to retrying.
 */
export const retryFailedSubtask = action({
  args: {
    sessionId: v.id("sandboxSessions"),
    taskId: v.id("tasks"),
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
      subtaskId: args.subtaskId,
      status: "retrying",
    });

    await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.executeNextSubtask, {
      sessionId: args.sessionId,
      taskId: args.taskId,
    });

    return { retrying: true };
  },
});

/**
 * Execute a single subtask in isolation. Provisions a sandbox, runs the one
 * subtask, and finalizes — does NOT proceed to the next subtask.
 */
export const executeSingleSubtask = action({
  args: {
    taskId: v.id("tasks"),
    subtaskId: v.id("subtasks"),
    repositoryId: v.id("sourceControlRepositories"),
    taskPrompt: v.optional(v.string()),
    skillId: v.optional(v.id("skills")),
    runtime: v.optional(v.union(v.literal("cloud"), v.literal("local"))),
    localDeviceId: v.optional(v.string()),
    localDeviceName: v.optional(v.string()),
    editorType: v.optional(
      v.union(v.literal("monaco"), v.literal("codemirror"), v.literal("none")),
    ),
    ttlMinutes: v.optional(v.number()),
    authProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("bedrock"),
        v.literal("vertex"),
        v.literal("azure"),
      ),
    ),
    model: v.optional(v.string()),
    presetId: v.optional(v.id("sandboxPresets")),
    mcpServerOverrides: v.optional(v.array(v.string())),
    queueReplayToken: v.optional(v.string()),
    queueReplayQueuedBy: v.optional(v.id("users")),
    suppressQueueFallback: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await resolveLaunchActor(ctx, args as any);
    const task = await ctx.runQuery(apiAny.tasks.get, { taskId: args.taskId });

    const subtask = await ctx.runQuery(internalAny.subtasks.getInternal, {
      subtaskId: args.subtaskId,
    });
    if (!subtask) throw new ConvexError("Subtask not found");
    if ((subtask as any).taskId.toString() !== args.taskId.toString()) {
      throw new ConvexError("Subtask does not belong to this task");
    }

    const runtime = args.runtime ?? "cloud";
    if (runtime === "local" && !args.localDeviceId) {
      throw new ConvexError("localDeviceId is required when runtime is local");
    }

    let repo: any;
    let token: string | undefined;
    if (runtime === "local") {
      repo = await ctx.runQuery(internalAny.sourceControl.repositories.getByIdInternal, {
        repositoryId: args.repositoryId,
      });
      if (!repo) throw new ConvexError("Repository not found");
    } else {
      const repoAndToken = await getRepoAndToken(ctx, args.repositoryId as string);
      repo = repoAndToken.repo;
      token = repoAndToken.token;
    }

    if (repo.orgId !== task.orgId || repo.programId !== task.programId) {
      throw new ConvexError("Repository does not belong to the task's organization/program");
    }

    const existingBranch = (task as any).worktreeBranch;
    const worktreeBranch = existingBranch || buildWorktreeBranch(String(task._id), task.title);
    const provisionalSandboxId = buildSandboxId(task.orgId, String(task._id));
    const localSandboxId = `local-${provisionalSandboxId}`;
    const taskPrompt = buildTaskPrompt(task, args.taskPrompt);

    let sessionId: string | undefined;
    try {
      sessionId = await ctx.runMutation(internalAny.sandbox.sessions.create, {
        orgId: task.orgId,
        programId: task.programId,
        taskId: task._id,
        repositoryId: repo._id,
        runtime,
        localDeviceId: args.localDeviceId,
        localDeviceName: args.localDeviceName,
        sandboxId: runtime === "local" ? localSandboxId : provisionalSandboxId,
        worktreeBranch,
        status: runtime === "local" ? "executing" : "provisioning",
        taskPrompt,
        skillId: args.skillId,
        assignedBy: authUser._id,
        executionMode: "subtask",
        editorType: args.editorType,
        ttlMinutes: args.ttlMinutes,
        authProvider: args.authProvider,
        model: args.model,
        presetId: args.presetId,
        runtimeMode: runtime === "local" ? "executing" : "idle",
        subtaskId: runtime === "local" ? args.subtaskId : undefined,
      });

      // Persist worktree branch on task for reuse across sessions
      if (!existingBranch) {
        try {
          await ctx.runMutation(internalAny.tasks.setWorktreeBranch, {
            taskId: args.taskId,
            worktreeBranch,
          });
        } catch {
          /* best effort */
        }
      }

      if (runtime === "local") {
        try {
          await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
            taskId: args.taskId,
            status: "in_progress",
          });
        } catch {
          // Best effort
        }

        await appendSystemLog(ctx, {
          orgId: task.orgId,
          sessionId: sessionId as string,
          taskId: args.taskId,
          message: `Started local runtime single subtask session: "${(subtask as any).title}"`,
          metadata: {
            runtime: "local",
            localDeviceId: args.localDeviceId,
            localDeviceName: args.localDeviceName,
            subtaskId: args.subtaskId,
            worktreeBranch,
          },
        });

        await recordAuditEvent(ctx, {
          session: {
            _id: sessionId,
            orgId: task.orgId,
            programId: task.programId,
            taskId: task._id,
            sandboxId: localSandboxId,
            worktreeBranch,
            taskPrompt,
            skillId: args.skillId,
            repositoryId: args.repositoryId,
            startedAt: Date.now(),
          },
          task,
          assignedBy: authUser,
          eventType: "sandbox_started",
          outcome: { status: "executing" },
        });

        return {
          sessionId,
          sandboxId: localSandboxId,
          worktreeBranch,
          status: "executing" as const,
          runtime: "local" as const,
        };
      }

      await appendSystemLog(ctx, {
        orgId: task.orgId,
        sessionId: sessionId as string,
        taskId: args.taskId,
        message: `Provisioning sandbox for single subtask: "${(subtask as any).title}"`,
      });

      const designFiles = await getDesignFilesForTask(ctx, String(task._id));
      let createResponse: unknown;
      try {
        createResponse = await callSandboxWorker({
          method: "POST",
          path: "/sandbox/create",
          body: {
            sandboxId: provisionalSandboxId,
            repoUrl: repo.repoFullName,
            branch: repo.defaultBranch,
            worktreeBranch,
            githubToken: token,
            keepAlive: true,
            sleepAfter: `${Math.max(5, Math.min(args.ttlMinutes ?? 15, 60))}m`,
            ttlMinutes: args.ttlMinutes,
            ...(designFiles ? { designFiles } : {}),
          },
          timeoutMs: 30_000,
        });
      } catch (createError) {
        if (shouldQueueWorkerCreateFailure(createError)) {
          if (args.suppressQueueFallback) throw createError;
          return await enqueueLaunchFallback(ctx, {
            orgId: task.orgId,
            taskId: args.taskId,
            sessionId,
            queueConfig: {
              launchMode: "single_subtask",
              repositoryId: args.repositoryId,
              taskPrompt,
              skillId: args.skillId,
              subtaskId: args.subtaskId,
              editorType: args.editorType,
              ttlMinutes: args.ttlMinutes,
              authProvider: args.authProvider,
              presetId: args.presetId,
              mcpServerOverrides: args.mcpServerOverrides,
              worktreeBranch,
              provisionalSandboxId,
            },
            fallbackError: createError,
          });
        }
        throw createError;
      }

      const createRecord = asRecord(createResponse);
      const workerSandboxId =
        typeof createRecord?.sandboxId === "string" && createRecord.sandboxId
          ? createRecord.sandboxId
          : provisionalSandboxId;
      const createLifecycle = parseWorkerLogsPayload(createResponse);

      await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
        orgId: task.orgId,
        sessionId,
        status: "cloning",
        sandboxId: workerSandboxId,
      });
      await syncSessionLifecycleMetadata(ctx, {
        orgId: task.orgId,
        sessionId: String(sessionId),
        setupProgress: createLifecycle.setupProgress,
        runtimeMode: createLifecycle.runtimeMode,
      });

      try {
        await ctx.runMutation(internalAny.tasks.updateStatusInternal, {
          taskId: args.taskId,
          status: "in_progress",
        });
      } catch {
        // Best effort
      }

      await recordAuditEvent(ctx, {
        session: {
          _id: sessionId,
          orgId: task.orgId,
          programId: task.programId,
          taskId: task._id,
          sandboxId: workerSandboxId,
          worktreeBranch,
          taskPrompt,
          skillId: args.skillId,
          repositoryId: args.repositoryId,
          startedAt: Date.now(),
        },
        task,
        assignedBy: authUser,
        eventType: "sandbox_started",
        outcome: { status: "cloning" },
      });

      // Schedule single subtask execution
      await ctx.scheduler.runAfter(
        0,
        internalAny.sandbox.orchestrator.executeSingleSubtaskInternal,
        {
          sessionId,
          taskId: args.taskId,
          subtaskId: args.subtaskId,
        },
      );

      return {
        sessionId,
        sandboxId: workerSandboxId,
        worktreeBranch,
        status: "cloning" as const,
      };
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      if (sessionId) {
        await markSessionFailed(ctx, sessionId, errorMessage);
      }
      throw new ConvexError(errorMessage);
    }
  },
});

/**
 * Internal action that executes exactly one subtask and finalizes.
 * Does NOT proceed to the next subtask.
 */
export const executeSingleSubtaskInternal = internalAction({
  args: {
    sessionId: v.id("sandboxSessions"),
    taskId: v.id("tasks"),
    subtaskId: v.id("subtasks"),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    if (["completed", "failed", "cancelled"].includes(context.session.status)) return;

    try {
      const subtask = await ctx.runQuery(internalAny.subtasks.getInternal, {
        subtaskId: args.subtaskId,
      });
      if (!subtask) {
        await markSessionFailed(ctx, args.sessionId, "Subtask not found");
        return;
      }

      const subtaskData = subtask as any;

      // Get all subtasks for count context
      const allSubtasks = await ctx.runQuery(internalAny.subtasks.listByTaskInternal, {
        taskId: args.taskId,
      });
      const subtaskList = (allSubtasks as any[]) ?? [];

      // Mark subtask as executing
      await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
        subtaskId: args.subtaskId,
        status: "executing",
      });

      // Build prior changelog from completed subtasks before this one
      const completedSubtasks = subtaskList.filter(
        (s: any) => s.status === "completed" && s.order < subtaskData.order,
      );
      const priorChangelog = completedSubtasks
        .map(
          (s: any) =>
            `[${s.order + 1}] ${s.title}: ${(s.filesChanged ?? []).join(", ") || "no files listed"}`,
        )
        .join("\n");

      await appendSystemLog(ctx, {
        orgId: context.session.orgId,
        sessionId: args.sessionId,
        taskId: args.taskId,
        message: `Executing single subtask ${subtaskData.order + 1}/${subtaskList.length}: "${subtaskData.title}"`,
        metadata: { subtaskId: args.subtaskId },
      });

      // Update parent task activity
      try {
        await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
          taskId: args.taskId,
        });
      } catch {
        // Best effort
      }

      // Build the subtask-scoped prompt
      const subtaskPrompt = [
        `SUBTASK ${subtaskData.order + 1}/${subtaskList.length}: ${subtaskData.title}`,
        "",
        subtaskData.prompt,
        "",
        priorChangelog ? `PRIOR CHANGES (context):\n${priorChangelog}` : "",
        subtaskData.allowedFiles?.length
          ? `SCOPE: Only modify files matching these patterns: ${subtaskData.allowedFiles.join(", ")}`
          : "",
        "Complete this subtask. Commit your changes when done.",
      ]
        .filter(Boolean)
        .join("\n");

      // Re-fetch GitHub token for single subtask execution
      let singleSubtaskToken: string | undefined;
      if (context.session.repositoryId) {
        try {
          const { token } = await getRepoAndToken(ctx, context.session.repositoryId);
          singleSubtaskToken = token;
        } catch {
          /* best effort */
        }
      }

      // Set session to executing with subtaskId
      try {
        await ctx.runMutation(internalAny.sandbox.sessions.updateStatus, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          status: "executing",
          subtaskId: args.subtaskId,
        });
      } catch {
        // may already be executing
      }

      // Execute in sandbox
      try {
        const executeResponse = await callSandboxWorker({
          method: "POST",
          path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}/execute`,
          body: {
            taskPrompt: subtaskPrompt,
            skillId: context.session.skillId,
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
            convexUrl: process.env.CONVEX_URL,
            hookSecret: process.env.SANDBOX_API_SECRET,
            githubToken: singleSubtaskToken,
          },
          timeoutMs: 330_000,
        });
        const executeLifecycle = parseWorkerLogsPayload(executeResponse);
        await syncSessionLifecycleMetadata(ctx, {
          orgId: context.session.orgId,
          sessionId: String(args.sessionId),
          setupProgress: executeLifecycle.setupProgress,
          runtimeMode: executeLifecycle.runtimeMode,
        });
      } catch (error) {
        const rawMessage = toErrorMessage(error);
        await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
          subtaskId: args.subtaskId,
          status: "failed",
          errorMessage: rawMessage,
        });

        try {
          await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
            taskId: args.taskId,
          });
        } catch {
          /* best effort */
        }

        await markSessionFailed(ctx, args.sessionId, `Subtask failed: ${rawMessage}`);
        return;
      }

      // Poll logs — on completion, finalize the session (no next subtask)
      await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.pollSingleSubtaskLogs, {
        sessionId: args.sessionId,
        taskId: args.taskId,
        subtaskId: args.subtaskId,
      });
    } catch (error) {
      const errorMessage = toErrorMessage(error);
      await markSessionFailed(ctx, args.sessionId, errorMessage);
    }
  },
});

/**
 * Poll logs for a single subtask execution. When done, marks subtask complete
 * and finalizes the session — does NOT schedule the next subtask.
 */
export const pollSingleSubtaskLogs = internalAction({
  args: {
    sessionId: v.id("sandboxSessions"),
    taskId: v.id("tasks"),
    subtaskId: v.id("subtasks"),
    cursor: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    stalePollCount: v.optional(v.number()),
    sawCompletionLog: v.optional(v.boolean()),
    completionDetectedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internalAny.sandbox.sessions.getTaskContext, {
      sessionId: args.sessionId,
    });
    if (!context?.session) return;

    if (["completed", "failed", "cancelled"].includes(context.session.status)) return;

    if (Date.now() - context.session.startedAt > MAX_SESSION_LIFETIME_MS) {
      await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
        subtaskId: args.subtaskId,
        status: "failed",
        errorMessage: "Session exceeded 15-minute execution limit",
      });
      await markSessionFailed(
        ctx,
        args.sessionId,
        "Sandbox session exceeded the 15-minute execution limit",
      );
      return;
    }

    try {
      const response = await callSandboxWorker({
        method: "GET",
        path: `/sandbox/${encodeURIComponent(context.session.sandboxId)}/logs`,
        query: { cursor: args.cursor, mode: "poll" },
        timeoutMs: 15_000,
      });
      const parsed = parseWorkerLogsPayload(response);
      await syncSessionLifecycleMetadata(ctx, {
        orgId: context.session.orgId,
        sessionId: String(args.sessionId),
        setupProgress: parsed.setupProgress,
        runtimeMode: parsed.runtimeMode,
      });

      if (parsed.entries.length > 0) {
        await ctx.runMutation(internalAny.sandbox.logs.appendBatch, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: args.taskId,
          entries: parsed.entries.map((entry) => ({
            timestamp: entry.timestamp ?? Date.now(),
            level: entry.level,
            message: entry.message,
            metadata: { ...entry.metadata, subtaskId: args.subtaskId },
          })),
        });
      }

      if (parsed.failed || parsed.error) {
        await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
          subtaskId: args.subtaskId,
          status: "failed",
          errorMessage: parsed.error ?? "Sandbox worker reported execution failure",
        });

        try {
          await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
            taskId: args.taskId,
          });
        } catch {
          /* best effort */
        }

        // Finalize session (no next subtask)
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.completeSession, {
          sessionId: args.sessionId,
        });
        return;
      }

      if (parsed.done) {
        // Skip updateStatusInternal if fallback already marked it completed
        if (!args.completionDetectedAt) {
          await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
            subtaskId: args.subtaskId,
            status: "completed",
            executionDurationMs: Date.now() - context.session.startedAt,
          });
        }

        await appendSystemLog(ctx, {
          orgId: context.session.orgId,
          sessionId: args.sessionId,
          taskId: args.taskId,
          message: `Single subtask completed successfully`,
          metadata: { subtaskId: args.subtaskId },
        });

        try {
          await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
            taskId: args.taskId,
          });
        } catch {
          /* best effort */
        }

        // Finalize session — do NOT schedule next subtask
        await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.completeSession, {
          sessionId: args.sessionId,
        });
        return;
      }

      // Fallback completion detection: text-based + stale poll counter
      const completionInCurrentEntries = parsed.entries.some((e) =>
        /^Execution complete/i.test(e.message),
      );
      const seenCompletion = args.sawCompletionLog || completionInCurrentEntries;
      const staleCount = parsed.entries.length === 0 ? (args.stalePollCount ?? 0) + 1 : 0;

      if (seenCompletion && staleCount >= 3) {
        const detectedAt = args.completionDetectedAt ?? Date.now();

        // First time hitting fallback: mark subtask completed, but keep polling for done: true
        if (!args.completionDetectedAt) {
          await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
            subtaskId: args.subtaskId,
            status: "completed",
            executionDurationMs: Date.now() - context.session.startedAt,
          });

          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: args.taskId,
            message: `Single subtask completed (fallback detection after stale polls) — waiting for worker readiness`,
            metadata: { subtaskId: args.subtaskId },
          });

          try {
            await ctx.runMutation(internalAny.subtasks.rollupToParentTask, {
              taskId: args.taskId,
            });
          } catch {
            /* best effort */
          }
        }

        // Hard timeout: if worker hasn't become ready in 2 min, force finalize
        if (Date.now() - detectedAt > 120_000) {
          await appendSystemLog(ctx, {
            orgId: context.session.orgId,
            sessionId: args.sessionId,
            taskId: args.taskId,
            message: `Worker still not ready after 2min, forcing completion via completeSession`,
            metadata: { subtaskId: args.subtaskId },
          });

          await ctx.scheduler.runAfter(0, internalAny.sandbox.orchestrator.completeSession, {
            sessionId: args.sessionId,
          });
          return;
        }

        // Keep polling — wait for done: true from worker
        await ctx.scheduler.runAfter(
          POLL_INTERVAL_MS,
          internalAny.sandbox.orchestrator.pollSingleSubtaskLogs,
          {
            sessionId: args.sessionId,
            taskId: args.taskId,
            subtaskId: args.subtaskId,
            cursor: parsed.nextCursor,
            retryCount: 0,
            stalePollCount: staleCount,
            sawCompletionLog: true,
            completionDetectedAt: detectedAt,
          },
        );
        return;
      }

      // Continue polling
      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internalAny.sandbox.orchestrator.pollSingleSubtaskLogs,
        {
          sessionId: args.sessionId,
          taskId: args.taskId,
          subtaskId: args.subtaskId,
          cursor: parsed.nextCursor,
          retryCount: 0,
          stalePollCount: staleCount,
          sawCompletionLog: seenCompletion,
          completionDetectedAt: args.completionDetectedAt,
        },
      );
    } catch (error) {
      const rawMessage = toErrorMessage(error);

      if (/not found/i.test(rawMessage)) {
        await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
          subtaskId: args.subtaskId,
          status: "failed",
          errorMessage: "Sandbox not found",
        });
        await markSessionFailed(ctx, args.sessionId, "Sandbox environment was not found");
        return;
      }

      const nextRetry = (args.retryCount ?? 0) + 1;
      if (nextRetry <= POLL_RETRY_LIMIT) {
        await ctx.scheduler.runAfter(
          nextRetry * 2_000,
          internalAny.sandbox.orchestrator.pollSingleSubtaskLogs,
          {
            sessionId: args.sessionId,
            taskId: args.taskId,
            subtaskId: args.subtaskId,
            cursor: args.cursor,
            retryCount: nextRetry,
            stalePollCount: args.stalePollCount,
            sawCompletionLog: args.sawCompletionLog,
            completionDetectedAt: args.completionDetectedAt,
          },
        );
        return;
      }

      await ctx.runMutation(internalAny.subtasks.updateStatusInternal, {
        subtaskId: args.subtaskId,
        status: "failed",
        errorMessage: rawMessage,
      });
      await markSessionFailed(ctx, args.sessionId, rawMessage);
    }
  },
});

export const __test__ = {
  getWorkerConfig,
  getQueueReplayToken,
  toErrorMessage,
  parseWorkerLogsPayload,
  callSandboxWorker,
  shouldQueueWorkerCreateFailure,
  parseQueueLaunchMode,
  toPositiveQueueLimit,
};
