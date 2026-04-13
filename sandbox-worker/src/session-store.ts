/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers";
import type { Sandbox as SdkSandbox } from "@cloudflare/sandbox";
import { getSandbox } from "@cloudflare/sandbox";
import type {
  ApiError,
  CreateSandboxRequest,
  CreateSandboxResponse,
  DeleteSandboxResponse,
  ExecuteSandboxRequest,
  ExecuteSandboxResponse,
  FinalizeSandboxRequest,
  FinalizeSandboxResponse,
  LogEvent,
  LogLevel,
  PollLogsResponse,
  RuntimeMode,
  SandboxLogStreamEvent,
  SandboxStatus,
  SessionLifecycleMetadata,
  SetupProgress,
  SetupStageName,
  StageState,
} from "@foundry/types";
import { buildSdkRunnerScript } from "./sdk-runner-template";
import type { Env, ManagerResult } from "./types";
import {
  buildCloneUrl,
  createPendingSetupProgress,
  type ExecOptions,
  errorToMessage,
  extractExitCode,
  extractTextOutput,
  firstString,
  formatSse,
  isRecord,
  normalizeSetupProgress,
  nowIso,
  redactRepoUrl,
  shellEscape,
  splitLines,
  stageMetadata,
  toExecOptions,
  validateCreateRequest,
  validateExecuteRequest,
} from "./utils";

const HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_EXEC_TIMEOUT_MS = 600_000;
const MAX_SSE_CONNECTION_MS = 10 * 60 * 1000; // 10 minutes
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 60;
const DEFAULT_TTL_MINUTES = 15;

interface LogSubscriber {
  push: (event: SandboxLogStreamEvent) => void;
  close: () => void;
}

interface SetupStageOptions {
  continueOnFailure?: boolean;
  skipWhenCompleted?: boolean;
  skipReason?: string;
}

type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "unknown";

interface ConvexInstallStatus {
  required: boolean;
  version: string | null;
  esmReady: boolean;
  packageManager: PackageManager;
}

export class SessionStore extends DurableObject<Env> {
  private sdkHandle?: SdkSandbox;
  private subscribers = new Map<string, LogSubscriber>();
  private sandboxId = "";
  private activeProcessId?: string;
  private activeProcessHandle?: { writeStdin?: (data: string) => Promise<void> };
  private fileWatcherCleanup?: () => void;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.initSql();
    });
  }

  private initSql(): void {
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS session_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS logs (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        sandbox_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT
      )`,
    );
    this.ctx.storage.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_logs_level_seq ON logs (level, sequence DESC)`,
    );
  }

  override async alarm(): Promise<void> {
    this.loadSandboxId();
    const status = this.getStatus();

    // Already deleted — nothing to clean up.
    if (status === "deleted") return;

    this.appendLog("system", "Session TTL expired. Cleaning up abandoned sandbox.");
    this.setRuntimeMode("hibernating", { reason: "Session TTL expired." });

    if (this.activeProcessId && this.sdkHandle) {
      try {
        await this.sdkHandle.killProcess(this.activeProcessId);
      } catch {
        /* process may have already exited */
      }
      this.activeProcessId = undefined;
    }

    if (this.sdkHandle) {
      try {
        await this.sdkHandle.destroy();
      } catch (error) {
        this.appendLog("error", `Cleanup error: ${errorToMessage(error)}`);
      }
      this.sdkHandle = undefined;
    }

    this.setMeta("status", "failed");
    this.appendStatus("failed", "Session expired (TTL exceeded).");
    this.closeSubscribers();
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    try {
      if (method === "POST" && path === "/create") {
        return this.jsonResponse(await this.handleCreate(request));
      }

      if (method === "POST" && path === "/execute") {
        return this.jsonResponse(await this.handleExecute(request));
      }

      if (method === "POST" && path === "/finalize") {
        return this.jsonResponse(await this.handleFinalize(request));
      }

      if (method === "GET" && path === "/logs") {
        const cursor = this.parseCursor(
          url.searchParams.get("cursor"),
          request.headers.get("last-event-id"),
        );
        const mode = url.searchParams.get("mode");

        if (mode === "poll") {
          return this.jsonResponse(this.handlePollLogs(cursor));
        }
        return this.handleSseStream(cursor);
      }

      if (method === "GET" && path === "/fs/list") {
        return this.jsonResponse(await this.handleListFiles(url.searchParams.get("path")));
      }

      if (method === "GET" && path === "/fs/read") {
        return this.jsonResponse(await this.handleReadFile(url.searchParams.get("path")));
      }

      if (method === "POST" && path === "/fs/write") {
        return this.jsonResponse(await this.handleWriteFile(request));
      }

      if (method === "POST" && path === "/message") {
        return this.jsonResponse(await this.handleSendMessage(request));
      }

      if (method === "POST" && path === "/repair") {
        return this.jsonResponse(await this.handleRepair(request));
      }

      if (method === "DELETE" && path === "/delete") {
        return this.jsonResponse(await this.handleDelete());
      }

      if (path === "/terminal" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
        return this.handleTerminal(request);
      }

      return this.jsonResponse(
        this.fail(404, {
          code: "NOT_FOUND",
          message: `Route not found: ${method} ${path}`,
        }),
      );
    } catch (error) {
      return this.jsonResponse(
        this.fail(500, {
          code: "INTERNAL_ERROR",
          message: "Unhandled SessionStore error.",
          details: { reason: errorToMessage(error) },
        }),
      );
    }
  }

  private async handleCreate(request: Request): Promise<ManagerResult<CreateSandboxResponse>> {
    const body = await this.readBody<CreateSandboxRequest>(request);
    if (!body.ok) return body;

    const data = body.data;
    const validationError = validateCreateRequest(data);
    if (validationError) {
      return this.fail(400, validationError);
    }

    this.sandboxId = data.sandboxId?.trim() || crypto.randomUUID();

    const existing = this.getMeta("sandboxId");
    if (existing) {
      return this.fail(409, {
        code: "CONFLICT",
        message: `Sandbox ${this.sandboxId} already exists.`,
      });
    }

    const createdAt = nowIso();
    const ttlMinutes = this.resolveTtlMinutes(data.ttlMinutes);
    this.setMeta("sandboxId", this.sandboxId);
    this.setMeta("repoUrl", data.repoUrl.trim());
    this.setMeta("branch", data.branch.trim());
    this.setMeta("worktreeBranch", data.worktreeBranch.trim());
    this.setMeta("createdAt", createdAt);
    this.setMeta("ttlMinutes", String(ttlMinutes));
    if (data.editorType) this.setMeta("editorType", data.editorType);
    if (data.authProvider) this.setMeta("authProvider", data.authProvider);
    if (data.presetId) this.setMeta("presetId", data.presetId);
    if (data.designFiles && Object.keys(data.designFiles).length > 0) {
      this.setMeta("designFiles", JSON.stringify(data.designFiles));
    }
    this.setMeta("status", "provisioning");
    this.setMeta("mode", "in-memory");
    this.setSetupProgress(createPendingSetupProgress());
    this.setRuntimeMode("idle", { silent: true });

    this.appendLog("system", "Provisioning sandbox.", {
      repoUrl: redactRepoUrl(data.repoUrl),
      branch: data.branch,
      worktreeBranch: data.worktreeBranch,
      ttlMinutes,
      editorType: data.editorType ?? "monaco",
      authProvider: data.authProvider ?? "anthropic",
    });

    if (!this.env.Sandbox) {
      this.setMeta("status", "ready");
      const warning =
        "Sandbox durable object binding is missing; running in in-memory fallback mode.";
      this.markAllSetupStagesSkippedForFallback(warning);
      this.appendLog("error", warning);
      this.appendStatus("ready", "Sandbox created in fallback mode.");
      return this.ok(201, {
        sandboxId: this.sandboxId,
        status: "ready" as SandboxStatus,
        createdAt,
        sdkAvailable: false,
        mode: "in-memory" as const,
        warning,
        ...this.getLifecycleMetadata(),
      });
    }

    if (typeof getSandbox !== "function") {
      this.setMeta("status", "ready");
      const warning =
        "@cloudflare/sandbox getSandbox is not a function; running in in-memory fallback mode.";
      this.markAllSetupStagesSkippedForFallback(warning);
      this.appendLog("error", warning);
      this.appendStatus("ready", "Sandbox created in fallback mode.");
      return this.ok(201, {
        sandboxId: this.sandboxId,
        status: "ready" as SandboxStatus,
        createdAt,
        sdkAvailable: false,
        mode: "in-memory" as const,
        warning,
        ...this.getLifecycleMetadata(),
      });
    }

    // DO stays alive automatically while async work is pending — waitUntil is a no-op in DOs.
    void this.provisionInBackground(data);

    // Set alarm to clean up abandoned sessions that exceed the requested TTL.
    await this.ctx.storage.setAlarm(Date.now() + ttlMinutes * 60_000);

    return this.ok(202, {
      sandboxId: this.sandboxId,
      status: "provisioning" as SandboxStatus,
      createdAt,
      sdkAvailable: true,
      mode: "cloudflare" as const,
      ...this.getLifecycleMetadata(),
    });
  }

  private async provisionInBackground(request: CreateSandboxRequest): Promise<void> {
    try {
      this.setMeta("status", "provisioning");
      this.appendStatus("provisioning", "Initializing Cloudflare sandbox container.");
      this.setRuntimeMode("idle");

      await this.runSetupStage("containerProvision", async () => {
        this.appendLog(
          "system",
          "Waiting for container to start...",
          stageMetadata("containerProvision", "running"),
        );

        this.sdkHandle = getSandbox(this.env.Sandbox!, this.sandboxId, {
          keepAlive: true,
          containerTimeouts: {
            instanceGetTimeoutMS: 60_000,
            portReadyTimeoutMS: 120_000,
          },
        });
        this.setMeta("mode", "cloudflare");
        this.appendLog(
          "system",
          "Container ready.",
          stageMetadata("containerProvision", "completed"),
        );
      });

      await this.setupWorkspace(request);

      await this.runSetupStage("ready", async () => {});

      this.setMeta("status", "ready");
      this.setRuntimeMode("idle");
      this.appendStatus("ready", "Sandbox workspace prepared.");
    } catch (error) {
      this.setMeta("status", "failed");
      this.setRuntimeMode("idle");
      const reason = errorToMessage(error);
      this.appendLog("error", `Sandbox provisioning failed: ${reason}`, { reason });
      this.appendStatus("failed", "Provisioning failed.");
    }
  }

  private async handleExecute(request: Request): Promise<ManagerResult<ExecuteSandboxResponse>> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    const body = await this.readBody<ExecuteSandboxRequest>(request);
    if (!body.ok) return body;

    const data = body.data;
    const validationError = validateExecuteRequest(data);
    if (validationError) {
      return this.fail(400, validationError);
    }

    const status = this.getStatus();
    if (status === "executing") {
      return this.fail(409, {
        code: "CONFLICT",
        message: `Sandbox ${this.sandboxId} is already executing.`,
      });
    }

    // If already failed, surface the reason immediately
    if (status === "failed") {
      const lastError = this.getLastErrorMessage();
      return this.fail(503, {
        code: "SDK_UNAVAILABLE",
        message: lastError || "Sandbox provisioning failed before execution could start.",
      });
    }

    // If still provisioning, wait for it
    if (status === "provisioning" || status === "cloning") {
      const ready = await this.waitForReady(300_000);
      if (!ready) {
        const lastError = this.getLastErrorMessage();
        const detail = lastError || "Sandbox provisioning did not complete in time.";
        return this.fail(503, {
          code: "SDK_UNAVAILABLE",
          message: detail,
        });
      }
    }

    // Store hook config for real-time event forwarding
    if (data.convexUrl) this.setMeta("convexUrl", data.convexUrl);
    if (data.hookSecret) this.setMeta("hookSecret", data.hookSecret);

    this.setMeta("status", "executing");
    this.setRuntimeMode("executing");
    this.appendStatus("executing", "Task execution started.");

    await this.ensureHandle();

    if (!this.sdkHandle) {
      this.setMeta("status", "failed");
      this.setRuntimeMode("idle");
      this.appendLog(
        "error",
        "Cloudflare Sandbox SDK is unavailable. Install @cloudflare/sandbox and configure the Sandbox binding.",
      );
      this.appendStatus("failed", "Execution failed.");
      return this.fail(503, {
        code: "SDK_UNAVAILABLE",
        message:
          "Cloudflare Sandbox SDK is unavailable. Install @cloudflare/sandbox and configure the Sandbox binding.",
      });
    }

    // DO stays alive automatically while async work is pending — waitUntil is a no-op in DOs.
    void this.executeInBackground(data);

    return this.ok(202, {
      sandboxId: this.sandboxId,
      accepted: true,
      startedAt: nowIso(),
      status: "executing" as SandboxStatus,
      ...this.getLifecycleMetadata(),
    });
  }

  private async handleFinalize(request: Request): Promise<ManagerResult<FinalizeSandboxResponse>> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    const body = await this.readBody<FinalizeSandboxRequest>(request, true);
    if (!body.ok) return body;

    const data = body.data;
    const status = this.getStatus();

    if (status === "executing") {
      this.appendLog("system", "Finalize called while still executing — waiting for completion.");
      const completed = await this.waitForExecutionComplete(120_000);
      if (!completed) {
        // Kill the active process to unblock finalization rather than failing outright.
        if (this.activeProcessId && this.sdkHandle) {
          try {
            await this.sdkHandle.killProcess(this.activeProcessId);
            this.appendLog("system", "Killed stale execution process to proceed with finalize.");
          } catch {
            /* process may have already exited */
          }
          this.activeProcessId = undefined;
        }
        this.setMeta("status", "ready");
        this.setRuntimeMode("idle");
      }
    }

    this.appendLog(
      "system",
      "DEPRECATED: /finalize endpoint called — completion webhooks are the preferred path.",
    );
    this.setMeta("status", "finalizing");
    this.setRuntimeMode("idle");
    this.appendStatus("finalizing", "Finalize started.");

    await this.ensureHandle();

    if (!this.sdkHandle) {
      this.setMeta("status", "failed");
      this.setRuntimeMode("idle");
      this.appendLog(
        "error",
        "Finalize requires Cloudflare Sandbox SDK support. The current session is running in fallback mode.",
      );
      this.appendStatus("failed", "Finalize failed.");
      return this.fail(503, {
        code: "SDK_UNAVAILABLE",
        message:
          "Finalize requires Cloudflare Sandbox SDK support. The current session is running in fallback mode.",
      });
    }

    try {
      const worktreeBranch = this.getMeta("worktreeBranch") || "main";
      const commitMessage =
        data.commitMessage?.trim() || `chore: finalize sandbox ${this.sandboxId}`;
      const pushBranch = data.pushBranch?.trim() || worktreeBranch;
      const shouldPush = data.push ?? true;

      let commitSha: string | undefined;
      const gitRoot = this.getGitRoot();
      const dir = shellEscape(gitRoot);

      if (!(await this.isGitRepo(gitRoot))) {
        this.appendLog("info", "Skipping finalize git ops — not a git repository.");
      } else {
        await this.ensureGitSafeDir(gitRoot);
        const hasChanges = await this.hasWorkspaceChanges();
        if (hasChanges) {
          await this.runCommand(`cd ${dir} && git add -A`, {});
          await this.runCommand(`cd ${dir} && git commit -m ${shellEscape(commitMessage)}`, {});
          commitSha = await this.readCommandText(`cd ${dir} && git rev-parse HEAD`);
          if (shouldPush) {
            await this.runCommand(
              `cd ${dir} && git push --set-upstream origin ${shellEscape(pushBranch)}`,
              {},
            );
          } else {
            this.appendLog("info", "Push skipped by request. Local commit retained in sandbox.");
          }
        } else {
          this.appendLog("info", "No working tree changes detected; skipping commit/push.");
        }
      }

      // Read file count from earlier captureFileDiffs
      const filesChangedStr = this.getMeta("filesChanged");
      const filesChanged = filesChangedStr ? parseInt(filesChangedStr, 10) : undefined;

      // Fall back to auto-commit SHA if finalize had no new changes
      if (!commitSha) {
        commitSha = this.getMeta("lastCommitSha") || undefined;
      }

      this.setMeta("status", "completed");
      this.setRuntimeMode("idle");
      await this.ctx.storage.deleteAlarm();
      const completedAt = nowIso();
      this.appendStatus("completed", "Finalize complete.");
      return this.ok(200, {
        sandboxId: this.sandboxId,
        status: "completed" as SandboxStatus,
        completedAt,
        commitSha,
        filesChanged,
        ...this.getLifecycleMetadata(),
      });
    } catch (error) {
      const reason = errorToMessage(error);
      this.setMeta("status", "failed");
      this.setRuntimeMode("idle");
      this.appendLog("error", `Finalize failed: ${reason}`, { reason });
      this.appendStatus("failed", "Finalize failed.");
      return this.fail(500, {
        code: "INTERNAL_ERROR",
        message: "Failed to finalize sandbox changes.",
        details: { reason },
      });
    }
  }

  private handlePollLogs(cursor?: number): ManagerResult<PollLogsResponse> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    const rows =
      cursor !== undefined
        ? this.ctx.storage.sql
            .exec(
              "SELECT sequence, sandbox_id, timestamp, level, message, metadata FROM logs WHERE sequence > ? ORDER BY sequence ASC",
              cursor,
            )
            .toArray()
        : this.ctx.storage.sql
            .exec(
              "SELECT sequence, sandbox_id, timestamp, level, message, metadata FROM logs ORDER BY sequence ASC",
            )
            .toArray();

    const entries = rows.map((row: Record<string, unknown>) => ({
      sequence: row.sequence as number,
      timestamp: row.timestamp as string,
      level: row.level as LogLevel,
      message: row.message as string,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
    }));

    const nextCursor =
      entries.length > 0
        ? String(entries[entries.length - 1].sequence)
        : cursor !== undefined
          ? String(cursor)
          : undefined;

    const status = this.getStatus();
    const done =
      status === "ready" ||
      status === "finalizing" ||
      status === "completed" ||
      status === "deleted";
    const failed = status === "failed";
    const lastError = failed
      ? (this.ctx.storage.sql
          .exec(
            "SELECT message FROM logs WHERE level IN ('error', 'stderr') ORDER BY sequence DESC LIMIT 1",
          )
          .toArray()[0]?.message as string | undefined)
      : undefined;

    return this.ok(200, {
      sandboxId: this.sandboxId,
      status,
      entries,
      done,
      failed,
      nextCursor,
      error: lastError,
      ...this.getLifecycleMetadata(),
    });
  }

  private handleSseStream(cursor?: number): Response {
    this.loadSandboxId();
    if (!this.sandboxId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "NOT_FOUND", message: "Sandbox not found." },
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }

    const encoder = new TextEncoder();
    const subscriberId = crypto.randomUUID();
    let heartbeatHandle: number | undefined;
    let connectionTimeoutHandle: number | undefined;
    const sandboxId = this.sandboxId;
    const status = this.getStatus();

    const cleanup = () => {
      this.unregisterSubscriber(subscriberId, heartbeatHandle, connectionTimeoutHandle);
    };

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const pushEvent = (event: SandboxLogStreamEvent): void => {
          try {
            controller.enqueue(encoder.encode(formatSse(event)));
          } catch {
            cleanup();
          }
        };

        // Replay from SQLite
        const rows =
          cursor !== undefined
            ? this.ctx.storage.sql
                .exec(
                  "SELECT sequence, sandbox_id, timestamp, level, message, metadata FROM logs WHERE sequence > ? ORDER BY sequence ASC",
                  cursor,
                )
                .toArray()
            : this.ctx.storage.sql
                .exec(
                  "SELECT sequence, sandbox_id, timestamp, level, message, metadata FROM logs ORDER BY sequence ASC",
                )
                .toArray();

        for (const row of rows) {
          const log: LogEvent = {
            sequence: row.sequence as number,
            sandboxId: row.sandbox_id as string,
            timestamp: row.timestamp as string,
            level: row.level as LogLevel,
            message: row.message as string,
            ...(row.metadata ? { metadata: JSON.parse(row.metadata as string) } : {}),
          };
          pushEvent({ type: "log", log });
        }

        pushEvent({
          type: "status",
          sandboxId,
          status,
          timestamp: nowIso(),
          message: "Subscribed to sandbox log stream.",
          ...this.getLifecycleMetadata(),
        });

        this.subscribers.set(subscriberId, {
          push: pushEvent,
          close: () => {
            try {
              controller.close();
            } catch {
              // no-op
            }
          },
        });

        heartbeatHandle = setInterval(() => {
          pushEvent({
            type: "heartbeat",
            timestamp: nowIso(),
          });
        }, HEARTBEAT_INTERVAL_MS) as unknown as number;

        // Auto-close SSE after max duration to prevent zombie connections.
        connectionTimeoutHandle = setTimeout(() => {
          pushEvent({
            type: "status",
            sandboxId,
            status: this.getStatus(),
            timestamp: nowIso(),
            message: "SSE connection timeout. Please reconnect.",
            ...this.getLifecycleMetadata(),
          });
          cleanup();
          try {
            controller.close();
          } catch {
            /* no-op */
          }
        }, MAX_SSE_CONNECTION_MS) as unknown as number;
      },
      cancel: () => {
        cleanup();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  }

  private async handleDelete(): Promise<ManagerResult<DeleteSandboxResponse>> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    if (this.activeProcessId && this.sdkHandle) {
      try {
        await this.sdkHandle.killProcess(this.activeProcessId);
      } catch {
        /* process may have already exited */
      }
      this.activeProcessId = undefined;
    }

    try {
      if (this.sdkHandle) {
        await this.sdkHandle.destroy();
        this.sdkHandle = undefined;
      }
    } catch (error) {
      this.appendLog("error", "Sandbox teardown reported an error.", {
        reason: errorToMessage(error),
      });
    }

    await this.ctx.storage.deleteAlarm();
    this.setMeta("status", "deleted");
    this.setRuntimeMode("idle");
    const lifecycle = this.getLifecycleMetadata();
    this.appendStatus("deleted", "Sandbox deleted.");
    this.closeSubscribers();

    const deletedAt = nowIso();

    // Clean up SQLite
    this.ctx.storage.sql.exec("DELETE FROM logs");
    this.ctx.storage.sql.exec("DELETE FROM session_meta");

    return this.ok(200, {
      sandboxId: this.sandboxId,
      deleted: true,
      deletedAt,
      ...lifecycle,
    });
  }

  private async handleRepair(
    request: Request,
  ): Promise<
    ManagerResult<{ sandboxId: string; repairedStages: string[]; status: SandboxStatus }>
  > {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    const status = this.getStatus();
    if (status === "executing") {
      return this.fail(409, {
        code: "CONFLICT",
        message: "Cannot repair while sandbox is executing.",
      });
    }
    if (status === "deleted") {
      return this.fail(404, {
        code: "NOT_FOUND",
        message: "Sandbox has been deleted.",
      });
    }

    // Read the original create request data from stored meta for stage re-execution.
    const body = await this.readBody<CreateSandboxRequest>(request);
    const createRequest = body.ok ? body.data : undefined;

    const progress = this.getSetupProgress();
    const repairedStages: string[] = [];

    // Identify and re-run failed or degraded stages.
    // runSetupStage with skipWhenCompleted=true will skip already-completed stages.
    const stageNames = Object.keys(progress) as SetupStageName[];
    for (const stage of stageNames) {
      const stageState = progress[stage];
      if (stageState.status === "failed") {
        repairedStages.push(stage);
      }
    }

    if (repairedStages.length === 0) {
      return this.ok(200, {
        sandboxId: this.sandboxId,
        repairedStages: [],
        status: this.getStatus(),
      });
    }

    this.appendLog(
      "system",
      `Repairing ${repairedStages.length} degraded stage(s): ${repairedStages.join(", ")}.`,
    );

    // Reset failed stages to pending so runSetupStage will re-execute them.
    for (const stage of repairedStages) {
      const currentProgress = this.getSetupProgress();
      currentProgress[stage as SetupStageName] = { status: "pending" };
      this.setSetupProgress(currentProgress);
    }

    // Ensure we have a handle.
    await this.ensureHandle();
    if (!this.sdkHandle) {
      return this.fail(503, {
        code: "SDK_UNAVAILABLE",
        message: "Cannot repair: sandbox handle is unavailable.",
      });
    }

    // Re-run the full workspace setup — completed stages will be skipped
    // automatically by runSetupStage's skipWhenCompleted logic.
    try {
      if (createRequest) {
        await this.setupWorkspace(createRequest);
      }
      this.setMeta("status", "ready");
      this.appendStatus("ready", "Repair complete.");
    } catch (error) {
      this.appendLog("error", `Repair failed: ${errorToMessage(error)}`);
    }

    return this.ok(200, {
      sandboxId: this.sandboxId,
      repairedStages,
      status: this.getStatus(),
    });
  }

  /**
   * Send a message to an active interactive session (SDK mode only).
   * The message is written to the runner process's stdin as a JSON command.
   */
  private async handleSendMessage(
    request: Request,
  ): Promise<ManagerResult<{ delivered: boolean }>> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    const status = this.getStatus();
    if (status !== "executing") {
      return this.fail(409, {
        code: "CONFLICT",
        message: "No active execution to send messages to.",
      });
    }

    const body = await this.readBody<{ content: string }>(request);
    if (!body.ok) return body;

    const content = body.data.content?.trim();
    if (!content) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "Message content is required.",
      });
    }

    // Write to the active process's stdin via the SDK handle.
    // The SDK runner reads JSON lines from stdin for interactive sessions.
    if (this.activeProcessHandle?.writeStdin) {
      try {
        await this.activeProcessHandle.writeStdin(
          `${JSON.stringify({ type: "user_message", content })}\n`,
        );
        this.appendLog("system", `User message delivered to interactive session.`);
        return this.ok(200, { delivered: true });
      } catch (err) {
        return this.fail(500, {
          code: "SDK_UNAVAILABLE",
          message: `Failed to deliver message: ${errorToMessage(err)}`,
        });
      }
    }

    // Fallback: write a message file that the runner could poll (less ideal).
    try {
      await this.sdkHandle?.exec(
        `echo ${shellEscape(JSON.stringify({ type: "user_message", content }))} >> /tmp/sdk-messages.jsonl`,
        {},
      );
      this.appendLog("system", "User message written to message file.");
      return this.ok(200, { delivered: true });
    } catch (err) {
      return this.fail(500, {
        code: "SDK_UNAVAILABLE",
        message: `Failed to write message: ${errorToMessage(err)}`,
      });
    }
  }

  private async handleListFiles(
    path: string | null,
  ): Promise<ManagerResult<Record<string, unknown>>> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    await this.ensureHandle();
    if (!this.sdkHandle) {
      return this.fail(503, {
        code: "SDK_UNAVAILABLE",
        message: "Sandbox is not available.",
      });
    }

    try {
      const resolved = this.resolveEditorPath(path);
      const script = [
        "const fs = require('fs');",
        "const path = require('path');",
        "const dir = process.argv[1];",
        "const entries = fs.readdirSync(dir, { withFileTypes: true })",
        "  .filter((entry) => entry.name !== '.' && entry.name !== '..')",
        "  .map((entry) => {",
        "    const fullPath = path.join(dir, entry.name);",
        "    let size = 0;",
        "    try {",
        "      size = entry.isFile() ? fs.statSync(fullPath).size : 0;",
        "    } catch {",
        "      size = 0;",
        "    }",
        "    return {",
        "      name: entry.name,",
        "      type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',",
        "      size,",
        "    };",
        "  })",
        "  .sort((a, b) => {",
        "    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;",
        "    return a.name.localeCompare(b.name);",
        "  });",
        "console.log(JSON.stringify({ entries }));",
      ].join("");

      const result = await this.execJsonCommand(
        `node -e ${shellEscape(script)} ${shellEscape(resolved.absolutePath)}`,
      );
      const entries = Array.isArray((result as Record<string, unknown>).entries)
        ? (result as Record<string, unknown>).entries
        : [];

      return this.ok(200, {
        sandboxId: this.sandboxId,
        cwd: resolved.relativePath,
        entries,
      });
    } catch (error) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "Failed to list files.",
        details: { reason: errorToMessage(error) },
      });
    }
  }

  private async handleReadFile(
    path: string | null,
  ): Promise<ManagerResult<Record<string, unknown>>> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    await this.ensureHandle();
    if (!this.sdkHandle) {
      return this.fail(503, {
        code: "SDK_UNAVAILABLE",
        message: "Sandbox is not available.",
      });
    }

    if (!path?.trim()) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "path query parameter is required.",
      });
    }

    try {
      const resolved = this.resolveEditorPath(path);
      const script = [
        "const fs = require('fs');",
        "const filePath = process.argv[1];",
        "const stat = fs.statSync(filePath);",
        "if (!stat.isFile()) {",
        "  throw new Error('Target path is not a file.');",
        "}",
        "const content = fs.readFileSync(filePath, 'utf8');",
        "console.log(JSON.stringify({ content, size: stat.size }));",
      ].join("");
      const result = (await this.execJsonCommand(
        `node -e ${shellEscape(script)} ${shellEscape(resolved.absolutePath)}`,
      )) as Record<string, unknown>;
      const content = typeof result.content === "string" ? result.content : "";
      const size = typeof result.size === "number" ? result.size : 0;

      return this.ok(200, {
        sandboxId: this.sandboxId,
        path: resolved.relativePath,
        content,
        size,
      });
    } catch (error) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "Failed to read file.",
        details: { reason: errorToMessage(error) },
      });
    }
  }

  private async handleWriteFile(request: Request): Promise<ManagerResult<Record<string, unknown>>> {
    this.loadSandboxId();
    if (!this.sandboxId) return this.notFound("unknown");

    await this.ensureHandle();
    if (!this.sdkHandle) {
      return this.fail(503, {
        code: "SDK_UNAVAILABLE",
        message: "Sandbox is not available.",
      });
    }

    const body = await this.readBody<{ path?: string; content?: string }>(request);
    if (!body.ok) return body as ManagerResult<Record<string, unknown>>;

    const path = typeof body.data.path === "string" ? body.data.path : "";
    const content = typeof body.data.content === "string" ? body.data.content : "";
    if (!path.trim()) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "path is required.",
      });
    }

    try {
      const resolved = this.resolveEditorPath(path);
      const script = [
        "const fs = require('fs');",
        "const path = require('path');",
        "const filePath = process.argv[1];",
        "const content = process.argv[2] || '';",
        "fs.mkdirSync(path.dirname(filePath), { recursive: true });",
        "fs.writeFileSync(filePath, content, 'utf8');",
        "console.log(JSON.stringify({ bytes: Buffer.byteLength(content, 'utf8') }));",
      ].join("");

      const result = (await this.execJsonCommand(
        `node -e ${shellEscape(script)} ${shellEscape(resolved.absolutePath)} ${shellEscape(content)}`,
      )) as Record<string, unknown>;
      const bytes = typeof result.bytes === "number" ? result.bytes : 0;

      return this.ok(200, {
        sandboxId: this.sandboxId,
        path: resolved.relativePath,
        bytes,
      });
    } catch (error) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "Failed to write file.",
        details: { reason: errorToMessage(error) },
      });
    }
  }

  private async handleTerminal(request: Request): Promise<Response> {
    if (!this.sdkHandle) {
      await this.ensureHandle();
    }
    if (!this.sdkHandle) {
      return new Response("Sandbox not available", { status: 503 });
    }

    const url = new URL(request.url);
    const cols = Number(url.searchParams.get("cols")) || 80;
    const rows = Number(url.searchParams.get("rows")) || 24;

    if (this.getRuntimeMode() === "executing") {
      this.setRuntimeMode("interactive", { reason: "WebSocket terminal attached." });
      this.appendStatus(this.getStatus(), "Interactive terminal session opened.");
    }

    // The terminal() method is available in @cloudflare/sandbox but not yet in published types.
    const handle = this.sdkHandle as unknown as {
      terminal(req: Request, opts: { cols: number; rows: number }): Promise<Response>;
    };
    return handle.terminal(request, { cols, rows });
  }

  // ── Handle reconnection ──────────────────────────────────────────

  private async ensureHandle(): Promise<void> {
    if (this.sdkHandle) return;

    if (!this.env.Sandbox || typeof getSandbox !== "function") return;

    const sandboxId = this.sandboxId || this.getMeta("sandboxId");
    if (!sandboxId) return;

    try {
      this.sdkHandle = getSandbox(this.env.Sandbox!, sandboxId, { keepAlive: true });
      if (this.getRuntimeMode() === "hibernating") {
        this.setRuntimeMode("idle", { reason: "Sandbox container reconnected." });
      }
      this.appendLog("system", "Reconnected to sandbox container.");
    } catch (error) {
      const reason = errorToMessage(error);
      this.appendLog("error", `Failed to reconnect to sandbox container: ${reason}`, {
        reason,
      });
    }
  }

  private async waitForReady(maxWaitMs: number): Promise<boolean> {
    const pollMs = 1_000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const status = this.getStatus();
      if (status === "ready" || status === "executing" || status === "completed") return true;
      if (status === "failed" || status === "deleted" || status === "finalizing") return false;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return false;
  }

  private async waitForExecutionComplete(maxWaitMs: number): Promise<boolean> {
    const pollMs = 1_000;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const status = this.getStatus();
      if (status !== "executing") return true;
      await new Promise((r) => setTimeout(r, pollMs));
    }
    return false;
  }

  private resolveTtlMinutes(raw: unknown): number {
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return DEFAULT_TTL_MINUTES;
    }
    return Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, Math.round(raw)));
  }

  private getLifecycleMetadata(): SessionLifecycleMetadata {
    return {
      setupProgress: this.getSetupProgress(),
      runtimeMode: this.getRuntimeMode(),
    };
  }

  private getRuntimeMode(): RuntimeMode {
    const mode = this.getMeta("runtimeMode");
    if (
      mode === "idle" ||
      mode === "executing" ||
      mode === "interactive" ||
      mode === "hibernating"
    ) {
      return mode;
    }
    return "idle";
  }

  private setRuntimeMode(mode: RuntimeMode, options?: { reason?: string; silent?: boolean }): void {
    const current = this.getRuntimeMode();
    if (current === mode) return;

    this.setMeta("runtimeMode", mode);
    if (options?.silent) return;

    this.appendLog("system", `Runtime mode transitioned: ${current} -> ${mode}`, {
      previousRuntimeMode: current,
      runtimeMode: mode,
      ...(options?.reason ? { reason: options.reason } : {}),
    });
    this.appendStatus(this.getStatus(), `Runtime mode updated to ${mode}.`);
  }

  private getSetupProgress(): SetupProgress {
    const raw = this.getMeta("setupProgress");
    if (!raw) return createPendingSetupProgress();

    try {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeSetupProgress(parsed);
    } catch {
      return createPendingSetupProgress();
    }
  }

  private setSetupProgress(progress: SetupProgress): void {
    this.setMeta("setupProgress", JSON.stringify(progress));
  }

  private updateSetupStageState(stage: SetupStageName, state: StageState): void {
    const progress = this.getSetupProgress();
    const nextProgress: SetupProgress = {
      ...progress,
      [stage]: state,
    };
    this.setSetupProgress(nextProgress);
  }

  private markStageRunning(stage: SetupStageName): number {
    const startedAt = Date.now();
    this.updateSetupStageState(stage, { status: "running", startedAt });
    this.appendLog(
      "system",
      `Stage started: ${stage}`,
      stageMetadata(stage, "running", { startedAt }),
    );
    this.appendStatus(this.getStatus(), `Stage running: ${stage}`);
    return startedAt;
  }

  private markStageCompleted(stage: SetupStageName, startedAt?: number): void {
    const previous = this.getSetupProgress()[stage];
    const resolvedStartedAt =
      startedAt ??
      (previous.status === "running" ||
      previous.status === "completed" ||
      previous.status === "failed"
        ? previous.startedAt
        : Date.now());
    const completedAt = Date.now();
    this.updateSetupStageState(stage, {
      status: "completed",
      startedAt: resolvedStartedAt,
      completedAt,
    });
    this.appendLog(
      "system",
      `Stage completed: ${stage}`,
      stageMetadata(stage, "completed", { startedAt: resolvedStartedAt, completedAt }),
    );
    this.appendStatus(this.getStatus(), `Stage completed: ${stage}`);
  }

  private markStageFailed(stage: SetupStageName, error: string, startedAt?: number): void {
    const previous = this.getSetupProgress()[stage];
    const resolvedStartedAt =
      startedAt ??
      (previous.status === "running" ||
      previous.status === "completed" ||
      previous.status === "failed"
        ? previous.startedAt
        : Date.now());
    const failedAt = Date.now();
    this.updateSetupStageState(stage, {
      status: "failed",
      startedAt: resolvedStartedAt,
      failedAt,
      error,
    });
    this.appendLog(
      "error",
      `Stage failed: ${stage} - ${error}`,
      stageMetadata(stage, "failed", { startedAt: resolvedStartedAt, failedAt, error }),
    );
    this.appendStatus(this.getStatus(), `Stage failed: ${stage}`);
  }

  private markStageSkipped(stage: SetupStageName, reason: string): void {
    const skippedAt = Date.now();
    this.updateSetupStageState(stage, {
      status: "skipped",
      skippedAt,
      reason,
    });
    this.appendLog(
      "system",
      `Stage skipped: ${stage} - ${reason}`,
      stageMetadata(stage, "skipped", { reason, skippedAt }),
    );
    this.appendStatus(this.getStatus(), `Stage skipped: ${stage}`);
  }

  private async runSetupStage(
    stage: SetupStageName,
    action: () => Promise<void>,
    options: SetupStageOptions = {},
  ): Promise<void> {
    const current = this.getSetupProgress()[stage];
    if ((options.skipWhenCompleted ?? true) && current.status === "completed") {
      this.appendLog(
        "system",
        `Stage already completed. Skipping rerun: ${stage}`,
        stageMetadata(stage, "completed", { replay: true }),
      );
      return;
    }

    if (options.skipReason) {
      this.markStageSkipped(stage, options.skipReason);
      return;
    }

    const startedAt = this.markStageRunning(stage);
    try {
      await action();
      this.markStageCompleted(stage, startedAt);
    } catch (error) {
      const reason = errorToMessage(error);
      this.markStageFailed(stage, reason, startedAt);
      if (!options.continueOnFailure) {
        throw error;
      }
    }
  }

  private markAllSetupStagesSkippedForFallback(reason: string): void {
    const now = Date.now();
    const progress = createPendingSetupProgress();
    progress.containerProvision = { status: "skipped", skippedAt: now, reason };
    progress.systemSetup = { status: "skipped", skippedAt: now, reason };
    progress.authSetup = { status: "skipped", skippedAt: now, reason };
    progress.claudeConfig = { status: "skipped", skippedAt: now, reason };
    progress.gitClone = { status: "skipped", skippedAt: now, reason };
    progress.depsInstall = { status: "skipped", skippedAt: now, reason };
    progress.mcpInstall = { status: "skipped", skippedAt: now, reason };
    progress.workspaceCustomization = { status: "skipped", skippedAt: now, reason };
    progress.healthCheck = { status: "skipped", skippedAt: now, reason };
    progress.ready = {
      status: "completed",
      startedAt: now,
      completedAt: now,
    };
    this.setSetupProgress(progress);
    this.appendLog(
      "system",
      "Setup stages marked for fallback mode.",
      stageMetadata("ready", "completed", { fallback: true, reason }),
    );
  }

  // ── Workspace setup ──────────────────────────────────────────────

  private async setupWorkspace(request: CreateSandboxRequest): Promise<void> {
    await Promise.all([
      this.runSetupStage("systemSetup", async () => {
        await this.stageSystemSetup();
      }),
      this.runSetupStage("authSetup", async () => {
        await this.stageAuthSetup(request);
      }),
      this.runSetupStage("claudeConfig", async () => {
        await this.stageClaudeConfig();
      }),
    ]);

    await this.runSetupStage("gitClone", async () => {
      this.setMeta("status", "cloning");
      this.appendStatus("cloning", "Cloning repository.");
      await this.stageGitClone(request);
    });

    await Promise.all([
      this.runSetupStage("depsInstall", async () => {
        await this.stageDepsInstall(request);
      }),
      this.runSetupStage("mcpInstall", async () => {
        await this.stageMcpInstall(request);
      }),
      this.runSetupStage("workspaceCustomization", async () => {
        await this.stageWorkspaceCustomization();
      }),
    ]);

    await this.runSetupStage("healthCheck", async () => {
      await this.stageHealthCheck();
    });
  }

  private async stageSystemSetup(): Promise<void> {
    await this.runCommand("id sandbox >/dev/null 2>&1 || useradd -m -s /bin/bash -u 1000 sandbox", {
      logMetadata: stageMetadata("systemSetup", "running"),
    });
    await this.runCommand(
      "mkdir -p /home/sandbox/.claude /home/sandbox/.config && chown -R sandbox:sandbox /home/sandbox",
      {
        logMetadata: stageMetadata("systemSetup", "running"),
      },
    );
    await this.runCommand("git config --global --add safe.directory /workspace", {
      logMetadata: stageMetadata("systemSetup", "running"),
    });
    await this.sdkHandle?.setEnvVars({
      HOME: "/home/sandbox",
    });
    this.appendLog(
      "system",
      "Sandbox HOME environment variable configured.",
      stageMetadata("systemSetup", "running"),
    );
  }

  private async stageClaudeConfig(): Promise<void> {
    await this.runCommand(
      "mkdir -p /home/sandbox/.claude && touch /home/sandbox/.claude/settings.json && chown -R sandbox:sandbox /home/sandbox/.claude",
      {
        logMetadata: stageMetadata("claudeConfig", "running"),
      },
    );
  }

  private async stageAuthSetup(request: CreateSandboxRequest): Promise<void> {
    const apiKey = request.anthropicApiKey?.trim();
    if (!apiKey) {
      this.appendLog(
        "system",
        "No API key provided in request; auth setup deferred to execution time.",
        stageMetadata("authSetup", "running"),
      );
      return;
    }

    // Inject the API key as a persistent environment variable so it's
    // available during both provisioning health checks and later execution.
    await this.sdkHandle?.setEnvVars({
      ANTHROPIC_API_KEY: apiKey,
    });

    // Also write it to the sandbox user's .bashrc so interactive shells
    // (e.g. terminal tab in the HUD) have access.
    await this.runCommand(
      `grep -q ANTHROPIC_API_KEY /home/sandbox/.bashrc 2>/dev/null || echo 'export ANTHROPIC_API_KEY="${apiKey}"' >> /home/sandbox/.bashrc`,
      {
        displayCommand: "echo 'export ANTHROPIC_API_KEY=***' >> /home/sandbox/.bashrc",
        logMetadata: stageMetadata("authSetup", "running"),
      },
    );

    this.appendLog(
      "system",
      `Auth provider credentials injected (${request.authProvider ?? "anthropic"}).`,
      stageMetadata("authSetup", "running"),
    );
  }

  private async stageMcpInstall(request: CreateSandboxRequest): Promise<void> {
    const servers = request.mcpServers;
    if (!servers || servers.length === 0) {
      this.appendLog(
        "system",
        "No MCP servers configured; skipping MCP install.",
        stageMetadata("mcpInstall", "running"),
      );
      return;
    }

    const metadata = stageMetadata("mcpInstall", "running");

    // Install each MCP server package globally so `npx` can find them.
    for (const server of servers) {
      const pkg = server.package.trim();
      if (!pkg) continue;

      this.appendLog("system", `Installing MCP server: ${pkg}`, metadata);
      await this.runCommand(`npm install -g ${shellEscape(pkg)}`, { logMetadata: metadata });
    }

    // Write the MCP server configuration into Claude's settings so it
    // discovers them at startup.
    const mcpConfig: Record<
      string,
      { command: string; args?: string[]; env?: Record<string, string> }
    > = {};
    for (const server of servers) {
      const pkg = server.package.trim();
      if (!pkg) continue;
      // Use the package name as the server key, stripping scope prefix for readability.
      const key = pkg.replace(/^@[^/]+\//, "");
      mcpConfig[key] = {
        command: "npx",
        args: ["-y", pkg, ...(server.args ?? [])],
        ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
      };
    }

    // Merge MCP config into existing Claude settings.
    const settingsPath = "/home/sandbox/.claude/settings.json";
    let existingSettings: Record<string, unknown> = {};
    try {
      const raw = await this.readCommandText(`cat ${settingsPath} 2>/dev/null || echo '{}'`);
      existingSettings = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      existingSettings = {};
    }

    const merged = {
      ...existingSettings,
      mcpServers: {
        ...((existingSettings.mcpServers as Record<string, unknown>) ?? {}),
        ...mcpConfig,
      },
    };

    await this.runCommand(
      `cat > ${settingsPath} << 'MCPEOF'\n${JSON.stringify(merged, null, 2)}\nMCPEOF\nchown sandbox:sandbox ${settingsPath}`,
      { logMetadata: metadata },
    );

    // Persist the MCP config so executeInBackground can pass it to the SDK runner.
    this.setMeta("mcpServersConfig", JSON.stringify(mcpConfig));

    this.appendLog("system", `${servers.length} MCP server(s) configured.`, metadata);
  }

  private async stageGitClone(request: CreateSandboxRequest): Promise<void> {
    const cloneUrl = buildCloneUrl(request.repoUrl, request.githubToken);
    const redactedCloneUrl = redactRepoUrl(cloneUrl);
    const worktreeBranch = this.getMeta("worktreeBranch") || request.worktreeBranch;
    const branch = this.getMeta("branch") || request.branch;

    await this.runCommand(
      "mkdir -p /workspace && rm -rf /workspace/* /workspace/.[!.]* 2>/dev/null || true",
      {
        logMetadata: stageMetadata("gitClone", "running"),
      },
    );

    if (this.sdkHandle?.gitCheckout) {
      this.appendLog(
        "system",
        `$ git clone ${redactedCloneUrl} /workspace`,
        stageMetadata("gitClone", "running"),
      );
      await this.sdkHandle.gitCheckout(cloneUrl, {
        branch,
        targetDir: "/workspace",
      });
    } else {
      await this.runCommand(`git clone ${shellEscape(cloneUrl)} /workspace`, {
        displayCommand: `git clone ${shellEscape(redactedCloneUrl)} /workspace`,
        logMetadata: stageMetadata("gitClone", "running"),
      });
    }

    // The SDK's gitCheckout can clone into /workspace/{repoName}; detect real repo root.
    let gitRoot = "/workspace";
    const hasGitAtRoot = await this.readCommandText(
      "test -d /workspace/.git && echo yes || echo no",
      {
        timeoutMs: 5_000,
        logMetadata: stageMetadata("gitClone", "running"),
      },
    );
    if (hasGitAtRoot !== "yes") {
      const detectedDir = await this.readCommandText(
        "ls -d /workspace/*/.git 2>/dev/null | head -1 | sed 's|/.git$||'",
        {
          timeoutMs: 5_000,
          logMetadata: stageMetadata("gitClone", "running"),
        },
      );
      if (detectedDir) {
        gitRoot = detectedDir;
        this.appendLog(
          "system",
          `Git repository detected at ${gitRoot} (SDK cloned into subdirectory).`,
          stageMetadata("gitClone", "running"),
        );
      }
    }
    this.setMeta("gitRoot", gitRoot);

    // Ensure git commands run cleanly from root context too.
    await this.runCommand(`git config --global --add safe.directory ${shellEscape(gitRoot)}`, {
      logMetadata: stageMetadata("gitClone", "running"),
    });

    // SB-002: Ensure origin remote has the token-embedded URL for push authentication.
    // SDK's gitCheckout may not persist the token in the remote config.
    await this.runCommand(
      `cd ${shellEscape(gitRoot)} && git remote set-url origin ${shellEscape(cloneUrl)}`,
      {
        displayCommand: `cd ${shellEscape(gitRoot)} && git remote set-url origin ${shellEscape(redactedCloneUrl)}`,
        logMetadata: stageMetadata("gitClone", "running"),
      },
    );

    const dir = shellEscape(gitRoot);

    // SB-001: Fetch without || true so failures are detected properly.
    let fetchSucceeded = true;
    try {
      await this.runCommand(`cd ${dir} && git fetch origin ${shellEscape(worktreeBranch)}`, {
        logMetadata: stageMetadata("gitClone", "running"),
      });
    } catch {
      // Fetch failure is expected when the branch doesn't exist on the remote yet.
      fetchSucceeded = false;
      this.appendLog(
        "system",
        `Branch ${worktreeBranch} not found on remote (fetch failed); will create it.`,
        stageMetadata("gitClone", "running"),
      );
    }

    const remoteBranchExists =
      fetchSucceeded &&
      (await this.readCommandText(
        `cd ${dir} && git rev-parse --verify origin/${shellEscape(worktreeBranch)} 2>/dev/null && echo yes || echo no`,
        {
          logMetadata: stageMetadata("gitClone", "running"),
        },
      )) === "yes";

    if (remoteBranchExists) {
      await this.runCommand(
        `cd ${dir} && git checkout -B ${shellEscape(worktreeBranch)} origin/${shellEscape(worktreeBranch)}`,
        {
          logMetadata: stageMetadata("gitClone", "running"),
        },
      );
    } else {
      await this.runCommand(`cd ${dir} && git checkout -B ${shellEscape(worktreeBranch)}`, {
        logMetadata: stageMetadata("gitClone", "running"),
      });
      // Push is best-effort — branch exists locally, execution can proceed without remote.
      // autoCommitAndPush() and hook auto-pushes will retry later.
      try {
        await this.runCommand(
          `cd ${dir} && git push --force-with-lease --set-upstream origin ${shellEscape(worktreeBranch)}`,
          {
            logMetadata: stageMetadata("gitClone", "running"),
          },
        );
      } catch (pushErr) {
        this.appendLog(
          "system",
          `Initial branch push failed (non-fatal): ${errorToMessage(pushErr)}. Will retry at end of execution.`,
          stageMetadata("gitClone", "running"),
        );
      }
    }
  }

  private async stageDepsInstall(request: CreateSandboxRequest): Promise<void> {
    const gitRoot = this.getGitRoot();
    const metadata = stageMetadata("depsInstall", "running");
    const installCommand =
      request.installCommand?.trim() ||
      `cd ${shellEscape(gitRoot)} && if [ -f bun.lock ] || [ -f bun.lockb ]; then bun install; elif [ -f package-lock.json ]; then npm ci; elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; elif [ -f package.json ]; then npm install; else echo 'No package manifest found; skipping install'; fi`;
    await this.runCommand(installCommand, {
      logMetadata: metadata,
    });
    await this.ensureConvexInstallIntegrity(gitRoot, installCommand, metadata);
  }

  private async ensureConvexInstallIntegrity(
    gitRoot: string,
    installCommand: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    let installStatus = await this.inspectConvexInstallStatus(gitRoot, metadata);
    if (!installStatus.required || installStatus.esmReady) return;

    this.appendLog(
      "system",
      "Detected incomplete Convex install (missing node_modules/convex/dist/esm/server/index.js). Retrying dependency install.",
      metadata,
    );
    await this.runCommand(installCommand, { logMetadata: metadata });
    installStatus = await this.inspectConvexInstallStatus(gitRoot, metadata);
    if (!installStatus.required || installStatus.esmReady) return;

    if (installStatus.packageManager === "npm") {
      const version = installStatus.version ?? "latest";
      this.appendLog(
        "system",
        `Retrying Convex package install (${version}) to repair module resolution.`,
        metadata,
      );
      await this.runCommand(
        `cd ${shellEscape(gitRoot)} && npm install --no-save ${shellEscape(`convex@${version}`)}`,
        { logMetadata: metadata },
      );
      installStatus = await this.inspectConvexInstallStatus(gitRoot, metadata);
      if (!installStatus.required || installStatus.esmReady) return;
    }

    throw new Error(
      "Convex install appears incomplete: node_modules/convex/dist/esm/server/index.js is still missing after repair attempts.",
    );
  }

  private async inspectConvexInstallStatus(
    gitRoot: string,
    metadata: Record<string, unknown>,
  ): Promise<ConvexInstallStatus> {
    const inspectScript = [
      "const fs=require('fs');",
      "let pkg={};",
      "try { pkg=JSON.parse(fs.readFileSync('./package.json','utf8')); } catch {}",
      "const version=(pkg.dependencies&&pkg.dependencies.convex)||(pkg.devDependencies&&pkg.devDependencies.convex)||null;",
      "const manager=fs.existsSync('./package-lock.json')?'npm':fs.existsSync('./yarn.lock')?'yarn':fs.existsSync('./pnpm-lock.yaml')?'pnpm':(fs.existsSync('./bun.lock')||fs.existsSync('./bun.lockb'))?'bun':'unknown';",
      "const esmReady=version?fs.existsSync('./node_modules/convex/dist/esm/server/index.js'):true;",
      "process.stdout.write(JSON.stringify({required:Boolean(version),version,esmReady,manager}));",
    ].join("");

    let output = "";
    try {
      output = await this.readCommandText(
        `cd ${shellEscape(gitRoot)} && node -e ${shellEscape(inspectScript)}`,
        { logMetadata: metadata },
      );
    } catch {
      return {
        required: false,
        version: null,
        esmReady: true,
        packageManager: "unknown",
      };
    }

    try {
      const parsed = JSON.parse(output) as unknown;
      if (!isRecord(parsed)) {
        return {
          required: false,
          version: null,
          esmReady: true,
          packageManager: "unknown",
        };
      }
      const required = parsed.required === true;
      const version =
        typeof parsed.version === "string" && parsed.version.trim().length > 0
          ? parsed.version.trim()
          : null;
      const esmReady = parsed.esmReady === true;
      const manager =
        parsed.manager === "npm" ||
        parsed.manager === "yarn" ||
        parsed.manager === "pnpm" ||
        parsed.manager === "bun"
          ? parsed.manager
          : "unknown";

      return {
        required,
        version,
        esmReady,
        packageManager: manager,
      };
    } catch {
      return {
        required: false,
        version: null,
        esmReady: true,
        packageManager: "unknown",
      };
    }
  }

  private async stageWorkspaceCustomization(): Promise<void> {
    const gitRoot = this.getGitRoot();
    const sandboxGitSafeDirCmd = `git config --global --add safe.directory ${shellEscape(gitRoot)}`;
    await this.runCommand(
      "touch /home/sandbox/.bashrc && chown sandbox:sandbox /home/sandbox/.bashrc",
      {
        logMetadata: stageMetadata("workspaceCustomization", "running"),
      },
    );
    await this.runCommand(`su -s /bin/bash -c ${shellEscape(sandboxGitSafeDirCmd)} sandbox`, {
      logMetadata: stageMetadata("workspaceCustomization", "running"),
    });

    // Write design context files if available
    const designFilesRaw = this.getMeta("designFiles");
    const designFiles: Record<string, string> | null = designFilesRaw
      ? (() => {
          try {
            return JSON.parse(designFilesRaw);
          } catch {
            return null;
          }
        })()
      : null;
    if (designFiles && Object.keys(designFiles).length > 0) {
      const designDir = `${gitRoot}/.foundry/design`;

      await this.runCommand(
        `mkdir -p ${shellEscape(designDir)} && chown -R sandbox:sandbox ${shellEscape(designDir)}`,
        { logMetadata: stageMetadata("workspaceCustomization", "running") },
      );

      for (const [fileName, content] of Object.entries(designFiles)) {
        const filePath = `${designDir}/${fileName}`;
        await this.runCommand(
          `cat > ${shellEscape(filePath)} << 'FOUNDRY_DESIGN_EOF'\n${content}\nFOUNDRY_DESIGN_EOF`,
          { logMetadata: stageMetadata("workspaceCustomization", "running") },
        );
      }

      await this.runCommand(`chown -R sandbox:sandbox ${shellEscape(designDir)}`, {
        logMetadata: stageMetadata("workspaceCustomization", "running"),
      });
    }
  }

  private async stageHealthCheck(): Promise<void> {
    const gitRoot = this.getGitRoot();
    const dir = shellEscape(gitRoot);
    const sandboxWriteCheckCmd = `test -w ${shellEscape(gitRoot)}`;
    const metadata = stageMetadata("healthCheck", "running");

    await this.runCommand(`chown -R sandbox:sandbox ${shellEscape(gitRoot)}`, {
      logMetadata: metadata,
    });
    await this.runCommand(`cd ${dir} && git rev-parse --is-inside-work-tree`, {
      logMetadata: metadata,
    });
    await this.runCommand(`su -s /bin/bash -c ${shellEscape(sandboxWriteCheckCmd)} sandbox`, {
      logMetadata: metadata,
    });
    await this.runCommand("command -v claude >/dev/null", {
      logMetadata: metadata,
    });

    // Agent SDK install skipped — CLI path is used for sandbox execution.
    // The SDK runner code remains in the codebase but is not activated.
    // To re-enable, uncomment the block below and set useAgentSdk: true in orchestrator.ts.
    //
    // await this.runCommand(
    //   "npm list -g @anthropic-ai/claude-agent-sdk >/dev/null 2>&1 || npm install -g @anthropic-ai/claude-agent-sdk --prefer-offline",
    //   { logMetadata: metadata },
    // );
    // await this.runCommand(
    //   'su -s /bin/bash -c \'NODE_PATH="$(npm root -g)" node -e "require.resolve(\\"@anthropic-ai/claude-agent-sdk\\")"\'  sandbox',
    //   { logMetadata: metadata },
    // );
    // this.setMeta("agentSdkAvailable", "true");
    // this.appendLog("system", "Claude Agent SDK verified.", metadata);
  }

  private getGitRoot(): string {
    return this.getMeta("gitRoot") || "/workspace";
  }

  /**
   * Reads the MCP server configuration that was stored during the mcpInstall
   * stage and returns it in the format expected by the SDK runner.
   */
  private getStoredMcpConfig(): Record<
    string,
    { command: string; args?: string[]; env?: Record<string, string> }
  > {
    try {
      const raw = this.getMeta("mcpServersConfig");
      if (!raw) return {};
      return JSON.parse(raw) as Record<
        string,
        { command: string; args?: string[]; env?: Record<string, string> }
      >;
    } catch {
      return {};
    }
  }

  private resolveEditorPath(rawPath: string | null): {
    absolutePath: string;
    relativePath: string;
  } {
    const gitRoot = this.getGitRoot();
    const trimmed = (rawPath ?? "").trim();
    if (!trimmed || trimmed === ".") {
      return { absolutePath: gitRoot, relativePath: "." };
    }

    if (trimmed.includes("\0")) {
      throw new Error("Invalid path.");
    }

    const normalized = trimmed.replace(/\\/g, "/");
    let relativePath: string;

    if (normalized.startsWith("/")) {
      if (normalized === gitRoot) {
        return { absolutePath: gitRoot, relativePath: "." };
      }
      const rootPrefix = `${gitRoot}/`;
      if (!normalized.startsWith(rootPrefix)) {
        throw new Error("Path must stay within the workspace root.");
      }
      relativePath = normalized.slice(rootPrefix.length);
    } else {
      relativePath = normalized;
    }

    const parts = relativePath
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length === 0) {
      return { absolutePath: gitRoot, relativePath: "." };
    }
    if (parts.some((part) => part === "." || part === "..")) {
      throw new Error("Path traversal is not allowed.");
    }

    const sanitizedRelativePath = parts.join("/");
    return {
      absolutePath: `${gitRoot}/${sanitizedRelativePath}`,
      relativePath: sanitizedRelativePath,
    };
  }

  private async execJsonCommand(
    command: string,
    timeoutMs = 20_000,
  ): Promise<Record<string, unknown>> {
    if (!this.sdkHandle || typeof this.sdkHandle.exec !== "function") {
      throw new Error("Sandbox handle does not support exec().");
    }

    const result = await this.sdkHandle.exec(command, { timeout: timeoutMs });
    const exitCode = extractExitCode(result);
    if (typeof exitCode === "number" && exitCode !== 0) {
      throw new Error(`Command failed with exit code ${exitCode}.`);
    }

    const output = extractTextOutput(result).trim();
    if (!output) return {};

    try {
      const parsed = JSON.parse(output) as unknown;
      if (isRecord(parsed)) return parsed;
      return {};
    } catch {
      throw new Error("Command did not return valid JSON.");
    }
  }

  // ── Execution ────────────────────────────────────────────────────

  private async executeInBackground(request: ExecuteSandboxRequest): Promise<void> {
    const LOG_FILE = "/tmp/claude-output.jsonl";
    const POLL_INTERVAL_MS = 3_000;

    try {
      const sdkHandle = this.sdkHandle;
      if (!sdkHandle || typeof sdkHandle.startProcess !== "function") {
        throw new Error("Sandbox handle does not support startProcess().");
      }

      const workingDirectory = request.workingDirectory?.trim() || "/workspace";

      // Set env vars at the sandbox level using the native SDK method.
      const sandboxEnv: Record<string, string> = {
        HOME: "/home/sandbox",
      };
      if (request.anthropicApiKey?.trim()) {
        sandboxEnv.ANTHROPIC_API_KEY = request.anthropicApiKey.trim();
      }
      await sdkHandle.setEnvVars(sandboxEnv);

      // Clean up any previous run artifacts.
      await sdkHandle.exec(
        `rm -f ${LOG_FILE} && touch ${LOG_FILE} && chown sandbox:sandbox ${LOG_FILE}`,
        {},
      );

      const useAgentSdk = request.useAgentSdk && this.getMeta("agentSdkAvailable") === "true";
      let command: string;

      if (useAgentSdk) {
        // ── Agent SDK path ──────────────────────────────────────────
        // Write the SDK runner script into the container and execute it
        // via Node.js instead of invoking the CLI directly.
        const RUNNER_FILE = "/tmp/sdk-runner.mjs";
        const mcpServers = this.getStoredMcpConfig();
        const hookConfig =
          request.convexUrl && request.hookSecret
            ? {
                convexUrl: request.convexUrl,
                hookSecret: request.hookSecret,
                sandboxId: this.sandboxId,
              }
            : undefined;

        const runnerScript = buildSdkRunnerScript({
          outputFile: LOG_FILE,
          mode: request.interactive ? "session" : "query",
          model: request.model,
          systemPromptAppend: request.systemPromptAppend,
          mcpServers,
          hookConfig,
        });

        await sdkHandle.exec(
          `cat > ${RUNNER_FILE} << 'SDKRUNNEREOF'\n${runnerScript}\nSDKRUNNEREOF\nchmod +x ${RUNNER_FILE} && chown sandbox:sandbox ${RUNNER_FILE}`,
          {},
        );

        // Ensure the SDK is importable via ESM by symlinking the global package
        // into the working directory's node_modules. ESM ignores NODE_PATH.
        await sdkHandle.exec(
          `mkdir -p ${shellEscape(workingDirectory)}/node_modules/@anthropic-ai && ` +
            `ln -sf $(npm root -g)/@anthropic-ai/claude-agent-sdk ${shellEscape(workingDirectory)}/node_modules/@anthropic-ai/claude-agent-sdk && ` +
            `chown -R sandbox:sandbox ${shellEscape(workingDirectory)}/node_modules`,
          {},
        );

        const innerCmd = `cd ${shellEscape(workingDirectory)} && node ${RUNNER_FILE} ${shellEscape(request.taskPrompt.trim())}`;
        command = `su -m -s /bin/bash -c ${shellEscape(innerCmd)} sandbox`;

        this.appendLog("system", "Starting Claude Agent SDK execution.");
      } else {
        // ── CLI path (legacy fallback) ──────────────────────────────
        // Write hook config for real-time event forwarding to Convex
        await this.configureHooks();

        const modelFlag = request.model ? ` --model ${shellEscape(request.model)}` : "";
        const innerCmd = `cd ${shellEscape(workingDirectory)} && claude${modelFlag} --dangerously-skip-permissions -p ${shellEscape(request.taskPrompt.trim())} --verbose --output-format stream-json > ${LOG_FILE} 2>&1`;
        command = `su -m -s /bin/bash -c ${shellEscape(innerCmd)} sandbox`;

        this.appendLog("system", "Starting Claude Code execution (CLI mode).");
      }

      const proc = await sdkHandle.startProcess(command, {
        cwd: workingDirectory,
        timeout: request.timeoutMs ?? DEFAULT_EXEC_TIMEOUT_MS,
      });

      this.activeProcessId = proc.id;
      // Store process handle for interactive message delivery.
      this.activeProcessHandle = {
        writeStdin:
          typeof (proc as any).writeStdin === "function"
            ? (data: string) => (proc as any).writeStdin(data)
            : undefined,
      };
      this.appendLog("system", `Process started (pid ${proc.pid}).`);

      // Set up file watcher on the git root (non-fatal).
      const gitRoot = this.getGitRoot();
      const changedFiles = new Set<string>();
      try {
        const watchHandle = (sdkHandle as any).watch(gitRoot, {
          include: ["**/*"],
          exclude: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**", "**/.next/**"],
          recursive: true,
          onEvent: (event: { type: string; path: string }) => {
            changedFiles.add(event.path);
            this.appendLog("system", `File ${event.type}: ${event.path}`, {
              fileChange: { type: event.type, path: event.path },
            });
          },
          onError: (err: unknown) => {
            this.appendLog("system", `File watcher error: ${errorToMessage(err)}`);
          },
        });
        // Store cleanup function — watch() may return a cleanup fn, AbortController, or object with stop/close.
        if (typeof watchHandle === "function") {
          this.fileWatcherCleanup = watchHandle;
        } else if (watchHandle && typeof watchHandle.stop === "function") {
          this.fileWatcherCleanup = () => watchHandle.stop();
        } else if (watchHandle && typeof watchHandle.close === "function") {
          this.fileWatcherCleanup = () => watchHandle.close();
        }
        this.appendLog("system", `File watcher started on ${gitRoot}.`);
      } catch (err) {
        this.appendLog("system", `File watcher setup failed (non-fatal): ${errorToMessage(err)}`);
      }

      // Poll the output file for new lines using simple exec() calls.
      // Each exec() is a standalone RPC request/response — no long-lived
      // streams that can disconnect.
      let bytesRead = 0;

      const readNewOutput = async (): Promise<string> => {
        const result = await this.retryExec(
          `dd if=${LOG_FILE} bs=1 skip=${bytesRead} 2>/dev/null || true`,
          { timeout: 10_000 },
        );
        return extractTextOutput(result);
      };

      const processNewOutput = (output: string): void => {
        if (!output) return;
        bytesRead += new TextEncoder().encode(output).byteLength;
        for (const line of output.split("\n")) {
          const trimmed = line.trim();
          if (trimmed) {
            this.processClaudeOutput("stdout", trimmed);
          }
        }
      };

      // Poll until the process exits.
      let running = true;
      let consecutiveFailures = 0;
      const MAX_CONSECUTIVE_FAILURES = 5;

      while (running) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

        // Read new output (with retry).
        try {
          const newOutput = await readNewOutput();
          processNewOutput(newOutput);
          consecutiveFailures = 0; // Reset on success
        } catch {
          consecutiveFailures++;
          this.appendLog(
            "system",
            `Poll failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}).`,
          );
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            throw new Error("Container became unresponsive after multiple retries.");
          }
          continue; // Skip status check this cycle, try again next poll
        }

        // Check if process is still alive via the SDK handle.
        try {
          await proc.getStatus();
          // exitCode is set when the process has exited.
          if (proc.exitCode !== undefined && proc.exitCode !== null) {
            running = false;
          }
        } catch {
          // getStatus() can fail if the process is gone — treat as exited.
          running = false;
        }
      }

      // Final read to pick up any remaining buffered output.
      await new Promise((r) => setTimeout(r, 1_000));
      try {
        const finalOutput = await readNewOutput();
        processNewOutput(finalOutput);
      } catch {
        this.appendLog("system", "Final output read failed; some output may be missing.");
      }

      // Stop file watcher before capturing diffs.
      this.stopFileWatcher();

      const exitCode = proc.exitCode ?? 0;
      this.appendLog("system", `Exit code: ${exitCode}`);

      // Always capture diffs and push, regardless of exit code.
      await this.captureFileDiffs(changedFiles);
      await this.autoCommitAndPush();

      if (exitCode !== 0) {
        throw new Error(`Claude Code exited with code ${exitCode}`);
      }

      // Push completion to Convex (fire-and-forget — pollLogs timeout is the safety net)
      await this.reportCompletion({
        status: "completed",
        commitSha: this.getMeta("lastCommitSha") || undefined,
        filesChanged: parseInt(this.getMeta("filesChanged") || "0", 10) || undefined,
      });

      this.setMeta("status", "ready");
      this.setRuntimeMode("idle");
      this.appendStatus("ready", "Task execution complete.");
    } catch (error) {
      this.setMeta("status", "failed");
      this.setRuntimeMode("idle");
      const reason = errorToMessage(error);
      this.appendLog("error", `Task execution failed: ${reason}`, { reason });
      this.appendStatus("failed", "Execution failed.");

      // Push failure to Convex (fire-and-forget)
      await this.reportCompletion({ status: "failed", error: reason });
    } finally {
      this.activeProcessId = undefined;
      this.activeProcessHandle = undefined;
      this.stopFileWatcher();
      try {
        await this.sdkHandle?.exec(`rm -f ${LOG_FILE}`, {});
      } catch {
        /* best-effort cleanup */
      }
    }
  }

  // ── Retry wrapper for polling exec calls ────────────────────────

  private async retryExec(
    command: string,
    options: Record<string, unknown>,
    maxRetries = 3,
  ): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.sdkHandle?.exec(command, options);
      } catch (error) {
        lastError = error;
        const msg = errorToMessage(error);
        // Only retry on 5xx / transient sandbox errors
        if (
          !msg.includes("500") &&
          !msg.includes("502") &&
          !msg.includes("503") &&
          !msg.includes("SandboxError")
        ) {
          throw error;
        }
        if (attempt < maxRetries) {
          const delay = 2 ** (attempt + 1) * 1000; // 2s, 4s, 8s
          this.appendLog(
            "system",
            `Container busy (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay / 1000}s...`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  // ── File watcher + diff capture ─────────────────────────────────

  private stopFileWatcher(): void {
    if (this.fileWatcherCleanup) {
      try {
        this.fileWatcherCleanup();
      } catch {
        /* best-effort */
      }
      this.fileWatcherCleanup = undefined;
    }
  }

  private async captureFileDiffs(changedFiles: Set<string>): Promise<void> {
    try {
      const workDir = this.getGitRoot();
      if (!(await this.isGitRepo(workDir))) {
        this.appendLog("system", "Skipping file diff capture — not a git repository.");
        return;
      }
      await this.ensureGitSafeDir(workDir);
      const hasChanges = await this.hasWorkspaceChanges();
      if (!hasChanges) {
        this.appendLog("system", "No workspace changes detected after execution.");
        return;
      }

      const statusOutput = await this.readCommandText(
        `cd ${shellEscape(workDir)} && git status --porcelain`,
      );
      // Stage untracked files as intent-to-add so git diff includes their content,
      // then capture the diff, then unstage everything to leave the working tree clean.
      const dir = shellEscape(workDir);
      await this.runCommand(`cd ${dir} && git add -N .`, {});
      const diffOutput = await this.readCommandText(
        `cd ${dir} && git diff HEAD --unified=3 --no-color`,
      );
      await this.runCommand(`cd ${dir} && git reset`, {});

      const files: Array<{ path: string; status: string }> = [];
      for (const line of statusOutput.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const status = trimmed.substring(0, 2).trim();
        const path = trimmed.substring(3);
        files.push({ path, status });
      }

      const diffs = this.splitDiffByFile(diffOutput);
      const totalFiles = files.length;
      this.setMeta("filesChanged", String(totalFiles));

      this.appendLog("system", `File changes captured: ${totalFiles} file(s) modified.`, {
        fileChangeSummary: { files, diffs, totalFiles },
      });

      // Also note any watcher-detected files not in git status (e.g., ignored files).
      for (const watchedPath of changedFiles) {
        if (!files.some((f) => watchedPath.endsWith(f.path))) {
          this.appendLog("system", `Watcher detected change outside git tracking: ${watchedPath}`);
        }
      }
    } catch (err) {
      this.appendLog("system", `Failed to capture file diffs (non-fatal): ${errorToMessage(err)}`);
    }
  }

  private splitDiffByFile(diffOutput: string): Record<string, string> {
    const diffs: Record<string, string> = {};
    if (!diffOutput.trim()) return diffs;

    const fileSections = diffOutput.split(/^(?=diff --git )/m);
    for (const section of fileSections) {
      const trimmed = section.trim();
      if (!trimmed) continue;

      // Extract file path from "diff --git a/path b/path"
      const headerMatch = trimmed.match(/^diff --git a\/(.+?) b\/(.+)/);
      if (headerMatch) {
        const filePath = headerMatch[2];
        diffs[filePath] = trimmed;
      }
    }
    return diffs;
  }

  private async autoCommitAndPush(): Promise<void> {
    try {
      const workDir = this.getGitRoot();
      if (!(await this.isGitRepo(workDir))) {
        this.appendLog("system", "Skipping auto-commit — not a git repository.");
        return;
      }
      await this.ensureGitSafeDir(workDir);
      const hasChanges = await this.hasWorkspaceChanges();
      if (!hasChanges) {
        this.appendLog("system", "No changes to auto-commit.");
        return;
      }

      const worktreeBranch = this.getMeta("worktreeBranch") || "main";
      const commitMessage = `chore(sandbox): auto-commit after execution [sandbox:${this.sandboxId}]`;
      const dir = shellEscape(workDir);

      await this.runCommand(`cd ${dir} && git add -A`, {});
      await this.runCommand(`cd ${dir} && git commit -m ${shellEscape(commitMessage)}`, {});

      const commitSha = await this.readCommandText(`cd ${dir} && git rev-parse HEAD`);
      this.setMeta("lastCommitSha", commitSha);
      this.appendLog("system", `Auto-committed: ${commitSha}`);

      await this.runCommand(
        `cd ${dir} && git push --set-upstream origin ${shellEscape(worktreeBranch)}`,
        {},
      );
      this.appendLog("system", `Pushed to origin/${worktreeBranch}.`);
    } catch (err) {
      this.appendLog("system", `Auto-commit/push failed (non-fatal): ${errorToMessage(err)}`);
    }
  }

  // ── Completion webhook ──────────────────────────────────────────

  /**
   * Push completion status to Convex via HTTP webhook, eliminating the
   * finalize race condition. Fire-and-forget with a short timeout —
   * pollLogs timeout fallback handles the case where this fails.
   */
  private async reportCompletion(args: {
    status: "completed" | "failed";
    commitSha?: string;
    filesChanged?: number;
    error?: string;
  }): Promise<void> {
    const convexUrl = this.getMeta("convexUrl");
    const hookSecret = this.getMeta("hookSecret");
    if (!convexUrl || !hookSecret) {
      this.appendLog("system", "Skipping completion webhook — no convexUrl/hookSecret configured.");
      return;
    }

    try {
      const body = JSON.stringify({
        session_id: this.sandboxId,
        status: args.status,
        commitSha: args.commitSha,
        filesChanged: args.filesChanged,
        error: args.error,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const response = await fetch(`${convexUrl}/api/sandbox/completion`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hookSecret}`,
          "Content-Type": "application/json",
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.appendLog("system", `Completion webhook returned ${response.status} (non-fatal).`);
      } else {
        this.appendLog("system", `Completion webhook sent (status=${args.status}).`);
      }
    } catch (err) {
      // Fire-and-forget — the pollLogs timeout fallback will handle it
      this.appendLog("system", `Completion webhook failed (non-fatal): ${errorToMessage(err)}`);
    }
  }

  // ── Hook configuration ─────────────────────────────────────────

  private async configureHooks(): Promise<void> {
    const convexUrl = this.getMeta("convexUrl");
    const hookSecret = this.getMeta("hookSecret");
    if (!convexUrl || !hookSecret) return;

    try {
      const sandboxId = this.sandboxId;
      // Shell script that reads hook event JSON from stdin and POSTs it to Convex
      const hookScript = [
        "#!/bin/bash",
        `curl -s -X POST "${convexUrl}/api/sandbox/hook-events" \\`,
        `  -H "Authorization: Bearer ${hookSecret}" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d "$(cat - | jq -c '. + {session_id: "${sandboxId}"}')" &`,
        "",
        "# Auto-push file changes (debounced, fire-and-forget)",
        'LOCKFILE="/tmp/.git-push-lock"',
        'if ! test -f "$LOCKFILE" || [ $(($(date +%s) - $(cat "$LOCKFILE"))) -gt 5 ]; then',
        '  date +%s > "$LOCKFILE"',
        '  (cd /workspace && git add . && git diff --cached --quiet || (git commit -m "wip: auto-sync" && git push)) 2>/dev/null &',
        "fi",
      ].join("\n");

      const hookConfig = JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              matcher: "Edit|Write|Bash",
              hooks: [{ type: "command", command: "bash /tmp/sandbox-hook.sh", timeout: 5000 }],
            },
          ],
          Stop: [
            {
              hooks: [{ type: "command", command: "bash /tmp/sandbox-hook.sh", timeout: 5000 }],
            },
          ],
        },
      });

      await this.sdkHandle?.exec(
        `cat > /tmp/sandbox-hook.sh << 'HOOKEOF'\n${hookScript}\nHOOKEOF\nchmod +x /tmp/sandbox-hook.sh`,
        {},
      );
      await this.sdkHandle?.exec(
        `mkdir -p /home/sandbox/.claude && cat > /home/sandbox/.claude/settings.json << 'SETTINGSEOF'\n${hookConfig}\nSETTINGSEOF\nchown -R sandbox:sandbox /home/sandbox/.claude`,
        {},
      );

      this.appendLog("system", "Hook config written for real-time event forwarding.");
    } catch (err) {
      this.appendLog("system", `Hook config setup failed (non-fatal): ${errorToMessage(err)}`);
    }
  }

  // ── Command helpers ──────────────────────────────────────────────

  private async runCommand(command: string, options: ExecOptions): Promise<unknown> {
    if (!this.sdkHandle || typeof this.sdkHandle.exec !== "function") {
      throw new Error("Sandbox handle does not support exec().");
    }

    const displayCommand = options.displayCommand || command;
    this.appendLog("system", `$ ${displayCommand}`, options.logMetadata);
    const result = await this.sdkHandle.exec(command, toExecOptions(options));
    this.logExecResult(result, options.logMetadata);

    const exitCode = extractExitCode(result);
    if (typeof exitCode === "number" && exitCode !== 0) {
      const stderr = firstString((result as any)?.stderr, (result as any)?.error);
      const stderrLines = stderr ? stderr.split("\n").filter(Boolean).slice(-10) : [];
      const snippet = stderrLines.length > 0 ? `\n${stderrLines.join("\n")}` : "";
      throw new Error(`Command failed with exit code ${exitCode}: ${displayCommand}${snippet}`);
    }

    return result;
  }

  private async isGitRepo(workDir: string): Promise<boolean> {
    try {
      // Use test -d to avoid git's "dubious ownership" check which fails
      // when the repo is owned by the sandbox user but we run as root.
      const result = await this.sdkHandle?.exec(
        `test -d ${shellEscape(workDir)}/.git || (cd ${shellEscape(workDir)} && git -c safe.directory='*' rev-parse --is-inside-work-tree 2>/dev/null)`,
        { timeout: 5_000 },
      );
      const exitCode = extractExitCode(result);
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /** Re-establish safe.directory so git commands run cleanly as root on sandbox-owned repos. */
  private async ensureGitSafeDir(workDir: string): Promise<void> {
    try {
      await this.sdkHandle?.exec(
        `git config --global --add safe.directory ${shellEscape(workDir)}`,
        { timeout: 5_000 },
      );
    } catch {
      /* best-effort */
    }
  }

  private async hasWorkspaceChanges(workDir?: string): Promise<boolean> {
    const dir = workDir || this.getGitRoot();
    const output = await this.readCommandText(`cd ${shellEscape(dir)} && git status --porcelain`);
    return output.length > 0;
  }

  private async readCommandText(command: string, options: ExecOptions = {}): Promise<string> {
    const result = await this.runCommand(command, options);
    return extractTextOutput(result).trim();
  }

  // ── Claude output parsing ────────────────────────────────────────

  private processClaudeOutput(streamType: string, data: string): void {
    if (streamType === "stderr") {
      this.appendLog("stderr", data);
      return;
    }

    // Claude's stream-json emits newline-delimited JSON
    for (const line of data.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>;
        this.logClaudeEvent(event);
      } catch {
        // Not JSON — log raw output
        this.appendLog("stdout", trimmed);
      }
    }
  }

  private logClaudeEvent(event: Record<string, unknown>): void {
    const type = typeof event.type === "string" ? event.type : "";

    switch (type) {
      case "assistant": {
        const message = event.message as Record<string, unknown> | undefined;
        const content = message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (
              block &&
              typeof block === "object" &&
              (block as Record<string, unknown>).type === "text"
            ) {
              this.appendLog("info", (block as Record<string, unknown>).text as string);
            }
          }
        }
        break;
      }
      case "tool_use": {
        const name = typeof event.name === "string" ? event.name : "unknown";
        const input = event.input as Record<string, unknown> | undefined;
        const summary = this.summarizeToolUse(name, input);
        this.appendLog("system", summary);
        break;
      }
      case "tool_result": {
        const isError = event.is_error === true;
        if (isError) {
          const errorText = typeof event.content === "string" ? event.content : "Tool error";
          this.appendLog("error", errorText);
        }
        break;
      }
      case "result": {
        const cost =
          typeof event.total_cost_usd === "number"
            ? `$${event.total_cost_usd.toFixed(4)}`
            : typeof event.cost_usd === "number"
              ? `$${event.cost_usd.toFixed(4)}`
              : undefined;
        const duration =
          typeof event.duration_ms === "number"
            ? `${(event.duration_ms / 1000).toFixed(1)}s`
            : undefined;
        const turns = typeof event.num_turns === "number" ? `${event.num_turns} turns` : undefined;
        const parts = ["Execution complete", duration, turns, cost].filter(Boolean);
        this.appendLog("system", parts.join(" | "));
        break;
      }
      case "system": {
        const subtype = typeof event.subtype === "string" ? event.subtype : "";
        if (subtype === "init") {
          // Capture session ID from the SDK init event
          if (typeof event.session_id === "string") {
            this.setMeta("claudeSessionId", event.session_id);
            this.appendLog("system", `Claude session: ${event.session_id}`);
          }
          if (typeof event.model === "string") {
            this.appendLog("system", `Model: ${event.model}`);
          }
        } else if (subtype === "session_id_captured") {
          // Explicit session ID capture from our SDK runner
          const sid = typeof event.claude_session_id === "string" ? event.claude_session_id : "";
          if (sid) {
            this.setMeta("claudeSessionId", sid);
          }
        } else if (subtype === "status") {
          // Compacting, etc.
          this.appendLog("system", `Status: ${event.status ?? "unknown"}`);
        } else if (subtype === "hook_response" || subtype === "hook_progress") {
          // Hook events — log for observability
          this.appendLog("system", `Hook [${event.hook_event ?? ""}]: ${event.output ?? ""}`);
        } else {
          this.appendLog("system", JSON.stringify(event));
        }
        break;
      }
      case "tool_progress": {
        const toolName = typeof event.tool_name === "string" ? event.tool_name : "unknown";
        const elapsed =
          typeof event.elapsed_time_seconds === "number" ? event.elapsed_time_seconds : 0;
        if (elapsed > 5) {
          this.appendLog("system", `Tool ${toolName} running (${elapsed.toFixed(0)}s)...`);
        }
        break;
      }
      case "tool_use_summary": {
        const summary = typeof event.summary === "string" ? event.summary : "";
        if (summary) {
          this.appendLog("system", summary);
        }
        break;
      }
      case "stream_event": {
        // Partial assistant message streaming — skip to reduce noise
        break;
      }
      default:
        // Unknown event type — log raw for debugging
        this.appendLog("stdout", JSON.stringify(event));
    }
  }

  private summarizeToolUse(name: string, input?: Record<string, unknown>): string {
    switch (name) {
      case "Write":
      case "write":
        return `Writing ${input?.file_path ?? "file"}`;
      case "Edit":
      case "edit":
        return `Editing ${input?.file_path ?? "file"}`;
      case "Read":
      case "read":
        return `Reading ${input?.file_path ?? "file"}`;
      case "Bash":
      case "bash":
        return `Running: ${typeof input?.command === "string" ? input.command.slice(0, 100) : "command"}`;
      case "Glob":
      case "glob":
        return `Searching for ${input?.pattern ?? "files"}`;
      case "Grep":
      case "grep":
        return `Searching for "${input?.pattern ?? "pattern"}"`;
      default:
        return `Using tool: ${name}`;
    }
  }

  private logExecResult(result: unknown, metadata?: Record<string, unknown>): void {
    if (result === undefined || result === null) return;

    if (typeof result === "string") {
      for (const line of splitLines(result)) {
        this.appendLog("stdout", line, metadata);
      }
      return;
    }

    if (!isRecord(result)) {
      this.appendLog("info", String(result), metadata);
      return;
    }

    const stdout = firstString(result.stdout, result.output);
    const stderr = firstString(result.stderr, result.error);
    if (stdout) {
      for (const line of splitLines(stdout)) {
        this.appendLog("stdout", line, metadata);
      }
    }
    if (stderr) {
      for (const line of splitLines(stderr)) {
        this.appendLog("stderr", line, metadata);
      }
    }

    const exitCode = extractExitCode(result);
    if (typeof exitCode === "number") {
      this.appendLog("system", `Exit code: ${exitCode}`, metadata);
    }
  }

  // ── SQLite helpers ───────────────────────────────────────────────

  private setMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO session_meta (key, value) VALUES (?, ?)",
      key,
      value,
    );
  }

  private getMeta(key: string): string | undefined {
    const row = this.ctx.storage.sql
      .exec("SELECT value FROM session_meta WHERE key = ?", key)
      .toArray()[0];
    return row ? (row.value as string) : undefined;
  }

  private getStatus(): SandboxStatus {
    return (this.getMeta("status") as SandboxStatus) || "provisioning";
  }

  private getLastErrorMessage(): string | undefined {
    // SB-023: Only query 'error' level — 'stderr' includes git progress output
    // (e.g., "Enumerating objects: 100%") which is not an actual error.
    const row = this.ctx.storage.sql
      .exec("SELECT message FROM logs WHERE level = 'error' ORDER BY sequence DESC LIMIT 1")
      .toArray()[0];
    return row ? (row.message as string) : undefined;
  }

  private loadSandboxId(): void {
    if (!this.sandboxId) {
      this.sandboxId = this.getMeta("sandboxId") || "";
    }
  }

  private appendLog(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const timestamp = nowIso();
    const sandboxId = this.sandboxId;
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    this.ctx.storage.sql.exec(
      "INSERT INTO logs (sandbox_id, timestamp, level, message, metadata) VALUES (?, ?, ?, ?, ?)",
      sandboxId,
      timestamp,
      level,
      message,
      metadataJson,
    );

    // Get the sequence assigned by AUTOINCREMENT
    const lastRow = this.ctx.storage.sql.exec("SELECT last_insert_rowid() as seq").toArray()[0];
    const sequence = lastRow?.seq as number;

    const log: LogEvent = {
      sequence,
      sandboxId,
      timestamp,
      level,
      message,
      ...(metadata ? { metadata } : {}),
    };

    this.publish({ type: "log", log });
  }

  private appendStatus(status: SandboxStatus, message?: string): void {
    const lifecycle = this.getLifecycleMetadata();
    this.publish({
      type: "status",
      sandboxId: this.sandboxId,
      status,
      timestamp: nowIso(),
      ...(message ? { message } : {}),
      setupProgress: lifecycle.setupProgress,
      runtimeMode: lifecycle.runtimeMode,
    });
  }

  // ── SSE helpers ──────────────────────────────────────────────────

  private publish(event: SandboxLogStreamEvent): void {
    for (const [id, subscriber] of this.subscribers.entries()) {
      try {
        subscriber.push(event);
      } catch {
        this.subscribers.delete(id);
      }
    }
  }

  private closeSubscribers(): void {
    for (const subscriber of this.subscribers.values()) {
      subscriber.close();
    }
    this.subscribers.clear();
  }

  private unregisterSubscriber(
    subscriberId: string,
    heartbeatHandle?: number,
    connectionTimeoutHandle?: number,
  ): void {
    if (typeof heartbeatHandle === "number") {
      clearInterval(heartbeatHandle);
    }
    if (typeof connectionTimeoutHandle === "number") {
      clearTimeout(connectionTimeoutHandle);
    }
    this.subscribers.delete(subscriberId);
  }

  // ── Request/Response helpers ─────────────────────────────────────

  private async readBody<T>(request: Request, allowEmpty = false): Promise<ManagerResult<T>> {
    let rawBody = "";
    try {
      rawBody = await request.text();
    } catch (error) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "Unable to read request body.",
        details: { reason: errorToMessage(error) },
      });
    }

    if (!rawBody.trim()) {
      if (allowEmpty) {
        return this.ok(200, {} as T);
      }
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
      });
    }

    try {
      const parsed = JSON.parse(rawBody) as unknown;
      if (!isRecord(parsed)) {
        return this.fail(400, {
          code: "BAD_REQUEST",
          message: "Request body must be a JSON object.",
        });
      }
      return this.ok(200, parsed as T);
    } catch (error) {
      return this.fail(400, {
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
        details: { reason: errorToMessage(error) },
      });
    }
  }

  private jsonResponse<T>(result: ManagerResult<T>): Response {
    if (result.ok) {
      return new Response(JSON.stringify({ ok: true, data: result.data }), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: false, error: result.error }), {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  }

  private parseCursor(...values: Array<string | null>): number | undefined {
    for (const value of values) {
      if (typeof value !== "string" || value.trim().length === 0) continue;
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return undefined;
  }

  private notFound(sandboxId: string): ManagerResult<never> {
    return this.fail(404, {
      code: "NOT_FOUND",
      message: `Sandbox ${sandboxId} was not found.`,
    });
  }

  private ok<T>(status: number, data: T): ManagerResult<T> {
    return { ok: true, status, data };
  }

  private fail<T>(status: number, error: ApiError): ManagerResult<T> {
    return { ok: false, status, error };
  }
}
