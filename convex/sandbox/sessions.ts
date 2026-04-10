import { ConvexError, v } from "convex/values";
import * as generatedApi from "../_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { assertOrgAccess, getAuthUser } from "../model/access";
import {
  sandboxRuntimeModeValidator,
  setupProgressStageValidator,
  setupProgressStateValidator,
  setupProgressValidator,
} from "./validators";

const internalApi: any = (generatedApi as any).internal;

export const sandboxSessionStatusValidator = v.union(
  v.literal("provisioning"),
  v.literal("cloning"),
  v.literal("executing"),
  v.literal("sleeping"),
  v.literal("ready"),
  v.literal("finalizing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled"),
  v.literal("deleting"),
);

export type SandboxSessionStatus =
  | "provisioning"
  | "cloning"
  | "executing"
  | "sleeping"
  | "ready"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled"
  | "deleting";

export const sandboxEditorTypeValidator = v.union(
  v.literal("monaco"),
  v.literal("codemirror"),
  v.literal("none"),
);

export const sandboxAuthProviderValidator = v.union(
  v.literal("anthropic"),
  v.literal("bedrock"),
  v.literal("vertex"),
  v.literal("azure"),
);

export const sandboxRuntimeValidator = v.union(v.literal("cloud"), v.literal("local"));

// Re-export from shared validators (also used by schema.ts)
export {
  sandboxRuntimeModeValidator,
  setupProgressStageValidator,
  setupProgressStateValidator,
  setupProgressValidator,
} from "./validators";

export type SandboxRuntime = "cloud" | "local";

const TERMINAL_STATUSES = new Set<SandboxSessionStatus>([
  "completed",
  "failed",
  "cancelled",
  "deleting",
]);

const ALLOWED_TRANSITIONS: Record<SandboxSessionStatus, Set<SandboxSessionStatus>> = {
  provisioning: new Set(["provisioning", "cloning", "failed", "cancelled"]),
  cloning: new Set(["cloning", "executing", "failed", "cancelled"]),
  executing: new Set(["executing", "sleeping", "finalizing", "failed", "cancelled"]),
  sleeping: new Set(["ready", "failed", "cancelled"]),
  ready: new Set(["executing", "sleeping", "failed", "cancelled"]),
  finalizing: new Set(["finalizing", "completed", "failed", "cancelled"]),
  completed: new Set(["completed", "deleting"]),
  failed: new Set(["failed", "deleting"]),
  cancelled: new Set(["cancelled", "deleting"]),
  deleting: new Set(["deleting"]),
};

export function isTerminalSessionStatus(status: SandboxSessionStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canTransitionSessionStatus(
  from: SandboxSessionStatus,
  to: SandboxSessionStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from].has(to);
}

type SessionLike = {
  status: SandboxSessionStatus;
  startedAt: number;
  completedAt?: number;
};

function applyTerminalTiming(
  session: SessionLike,
  patch: Record<string, unknown>,
  completedAtOverride?: number,
  durationMsOverride?: number,
) {
  if (session.completedAt !== undefined) return;

  const completedAt = completedAtOverride ?? Date.now();
  patch.completedAt = completedAt;
  patch.durationMs = durationMsOverride ?? Math.max(0, completedAt - session.startedAt);
}

function applyOptionalPatchValue(patch: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) patch[key] = value;
}

function resolveSessionRuntime(runtime: unknown): SandboxRuntime {
  return runtime === "local" ? "local" : "cloud";
}

async function getSessionForAuthorizedUser(ctx: Parameters<typeof getAuthUser>[0], sessionId: any) {
  const user = await getAuthUser(ctx);
  const db = ctx.db as any;
  const session = await db.get(sessionId);
  if (!session) throw new ConvexError("Sandbox session not found");
  if (!user.orgIds.includes(session.orgId)) throw new ConvexError("Access denied");
  return { db, session, user };
}

/** Retrieve a sandbox session by ID. Returns null if not found. */
export const get = query({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) return null;
    await assertOrgAccess(ctx, session.orgId);
    return session;
  },
});

/** Get the most recent sandbox session for a given task. */
export const getByTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new ConvexError("Task not found");
    await assertOrgAccess(ctx, task.orgId);

    const db = ctx.db as any;
    const session =
      (await db
        .query("sandboxSessions")
        .withIndex("by_task_started", (q: any) => q.eq("taskId", args.taskId))
        .order("desc")
        .first()) ?? null;

    // Enrich with repoFullName for GitHub URL construction
    if (session?.repositoryId) {
      const repo = await ctx.db.get(session.repositoryId);
      if (repo) {
        session.repoFullName = (repo as any).repoFullName;
      }
    }

    return session;
  },
});

/** List sandbox sessions for a program with optional status and runtime filters. */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    status: v.optional(sandboxSessionStatusValidator),
    runtime: v.optional(sandboxRuntimeValidator),
    localDeviceId: v.optional(v.string()),
    runtimeMode: v.optional(sandboxRuntimeModeValidator),
    isPinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const db = ctx.db as any;
    let sessions = await db
      .query("sandboxSessions")
      .withIndex("by_program", (q: any) => q.eq("programId", args.programId))
      .collect();

    if (args.status !== undefined) {
      sessions = sessions.filter(
        (session: { status: SandboxSessionStatus }) => session.status === args.status,
      );
    }
    if (args.runtime !== undefined) {
      sessions = sessions.filter(
        (session: { runtime?: SandboxRuntime }) =>
          resolveSessionRuntime(session.runtime) === args.runtime,
      );
    }
    if (args.localDeviceId !== undefined) {
      sessions = sessions.filter(
        (session: { localDeviceId?: string }) => session.localDeviceId === args.localDeviceId,
      );
    }
    if (args.runtimeMode !== undefined) {
      sessions = sessions.filter(
        (session: { runtimeMode?: string }) => session.runtimeMode === args.runtimeMode,
      );
    }
    if (args.isPinned !== undefined) {
      sessions = sessions.filter(
        (session: { isPinned?: boolean }) => (session.isPinned ?? false) === args.isPinned,
      );
    }

    sessions.sort(
      (a: { startedAt: number }, b: { startedAt: number }) => b.startedAt - a.startedAt,
    );
    return sessions;
  },
});

/** List sandbox sessions across all programs in an organization. */
export const listByOrg = query({
  args: {
    orgId: v.string(),
    status: v.optional(sandboxSessionStatusValidator),
    runtime: v.optional(sandboxRuntimeValidator),
    localDeviceId: v.optional(v.string()),
    runtimeMode: v.optional(sandboxRuntimeModeValidator),
    isPinned: v.optional(v.boolean()),
    programId: v.optional(v.id("programs")),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const db = ctx.db as any;

    let sessions =
      args.runtime === "local"
        ? await db
            .query("sandboxSessions")
            .withIndex("by_runtime", (q: any) => q.eq("orgId", args.orgId).eq("runtime", "local"))
            .collect()
        : await db
            .query("sandboxSessions")
            .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
            .collect();

    if (args.status !== undefined) {
      sessions = sessions.filter(
        (session: { status: SandboxSessionStatus }) => session.status === args.status,
      );
    }
    if (args.runtime !== undefined) {
      sessions = sessions.filter(
        (session: { runtime?: SandboxRuntime }) =>
          resolveSessionRuntime(session.runtime) === args.runtime,
      );
    }
    if (args.localDeviceId !== undefined) {
      sessions = sessions.filter(
        (session: { localDeviceId?: string }) => session.localDeviceId === args.localDeviceId,
      );
    }
    if (args.runtimeMode !== undefined) {
      sessions = sessions.filter(
        (session: { runtimeMode?: string }) => session.runtimeMode === args.runtimeMode,
      );
    }
    if (args.isPinned !== undefined) {
      sessions = sessions.filter(
        (session: { isPinned?: boolean }) => (session.isPinned ?? false) === args.isPinned,
      );
    }
    if (args.programId !== undefined) {
      sessions = sessions.filter(
        (session: { programId: string }) => session.programId === args.programId,
      );
    }

    sessions.sort(
      (a: { startedAt: number }, b: { startedAt: number }) => b.startedAt - a.startedAt,
    );
    return sessions;
  },
});

export const getInternal = internalQuery({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db.get(args.sessionId);
  },
});

export const getBySandboxId = internalQuery({
  args: { sandboxId: v.string() },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db
      .query("sandboxSessions")
      .withIndex("by_sandboxId", (q: any) => q.eq("sandboxId", args.sandboxId))
      .first();
  },
});

/** Cancel a running sandbox session. */
export const cancel = mutation({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const { db, session } = await getSessionForAuthorizedUser(ctx, args.sessionId);

    if (isTerminalSessionStatus(session.status)) {
      return args.sessionId;
    }
    if (!canTransitionSessionStatus(session.status, "cancelled")) {
      throw new ConvexError(`Invalid status transition from ${session.status} to cancelled`);
    }

    const patch: Record<string, unknown> = {
      status: "cancelled",
      runtimeMode: "idle",
    };
    applyTerminalTiming(session, patch);
    await db.patch(args.sessionId, patch);
    return args.sessionId;
  },
});

export const getTaskContext = internalQuery({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) return null;

    const [task, program, assignedBy] = await Promise.all([
      ctx.db.get(session.taskId),
      ctx.db.get(session.programId),
      ctx.db.get(session.assignedBy),
    ]);

    return { session, task, program, assignedBy };
  },
});

export const create = internalMutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    taskId: v.id("tasks"),
    repositoryId: v.optional(v.id("sourceControlRepositories")),
    runtime: v.optional(sandboxRuntimeValidator),
    localDeviceId: v.optional(v.string()),
    localDeviceName: v.optional(v.string()),
    sandboxId: v.string(),
    worktreeBranch: v.string(),
    status: v.optional(sandboxSessionStatusValidator),
    taskPrompt: v.string(),
    skillId: v.optional(v.id("skills")),
    assignedBy: v.id("users"),
    startedAt: v.optional(v.number()),
    keepAlive: v.optional(v.boolean()),
    sleepAfter: v.optional(v.string()),
    editorType: v.optional(sandboxEditorTypeValidator),
    ttlMinutes: v.optional(v.number()),
    authProvider: v.optional(sandboxAuthProviderValidator),
    model: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
    pinnedAt: v.optional(v.number()),
    pinnedBy: v.optional(v.id("users")),
    setupProgress: v.optional(setupProgressValidator),
    runtimeMode: v.optional(sandboxRuntimeModeValidator),
    claudeSessionId: v.optional(v.string()),
    presetId: v.optional(v.id("sandboxPresets")),
    subtaskId: v.optional(v.id("subtasks")),
    executionMode: v.optional(v.union(v.literal("standard"), v.literal("subtask"))),
  },
  handler: async (ctx, args) => {
    const [program, task, assignedBy] = await Promise.all([
      ctx.db.get(args.programId),
      ctx.db.get(args.taskId),
      ctx.db.get(args.assignedBy),
    ]);

    if (!program) throw new ConvexError("Program not found");
    if (!task) throw new ConvexError("Task not found");
    if (!assignedBy) throw new ConvexError("Assigned-by user not found");

    if (program.orgId !== args.orgId) {
      throw new ConvexError("Program organization mismatch");
    }
    if (task.orgId !== args.orgId || task.programId !== args.programId) {
      throw new ConvexError("Task does not belong to the provided org/program");
    }
    if (!assignedBy.orgIds.includes(args.orgId)) {
      throw new ConvexError("Assigned-by user does not belong to the organization");
    }

    if (args.repositoryId) {
      const repo = await ctx.db.get(args.repositoryId);
      if (!repo) throw new ConvexError("Repository not found");
      if (repo.orgId !== args.orgId || repo.programId !== args.programId) {
        throw new ConvexError("Repository does not belong to the provided org/program");
      }
    }

    if (args.pinnedBy) {
      const pinUser = await ctx.db.get(args.pinnedBy);
      if (!pinUser) throw new ConvexError("Pinned-by user not found");
      if (!pinUser.orgIds.includes(args.orgId)) {
        throw new ConvexError("Pinned-by user does not belong to the organization");
      }
    }

    if (args.presetId) {
      const preset = await ctx.db.get(args.presetId);
      if (!preset) throw new ConvexError("Preset not found");
      if (preset.orgId !== args.orgId) {
        throw new ConvexError("Preset does not belong to the provided organization");
      }
    }

    const status = args.status ?? "provisioning";
    if (isTerminalSessionStatus(status)) {
      throw new ConvexError("Cannot create a session directly in a terminal status");
    }

    const runtime = args.runtime ?? "cloud";
    if (runtime === "local" && !args.localDeviceId) {
      throw new ConvexError("localDeviceId is required when runtime is local");
    }
    if (runtime === "cloud" && (args.localDeviceId || args.localDeviceName)) {
      throw new ConvexError("localDevice* fields require runtime=local");
    }

    const db = ctx.db as any;
    return await db.insert("sandboxSessions", {
      orgId: args.orgId,
      programId: args.programId,
      taskId: args.taskId,
      repositoryId: args.repositoryId,
      runtime,
      localDeviceId: args.localDeviceId,
      localDeviceName: args.localDeviceName,
      sandboxId: args.sandboxId,
      worktreeBranch: args.worktreeBranch,
      status,
      taskPrompt: args.taskPrompt,
      skillId: args.skillId,
      assignedBy: args.assignedBy,
      startedAt: args.startedAt ?? Date.now(),
      keepAlive: args.keepAlive,
      sleepAfter: args.sleepAfter,
      editorType: args.editorType,
      ttlMinutes: args.ttlMinutes,
      authProvider: args.authProvider,
      model: args.model,
      isPinned: args.isPinned,
      pinnedAt: args.pinnedAt,
      pinnedBy: args.pinnedBy,
      setupProgress: args.setupProgress,
      runtimeMode: args.runtimeMode,
      claudeSessionId: args.claudeSessionId,
      presetId: args.presetId,
      subtaskId: args.subtaskId,
      executionMode: args.executionMode,
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    status: sandboxSessionStatusValidator,
    sandboxId: v.optional(v.string()),
    error: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    editorType: v.optional(sandboxEditorTypeValidator),
    ttlMinutes: v.optional(v.number()),
    authProvider: v.optional(sandboxAuthProviderValidator),
    isPinned: v.optional(v.boolean()),
    pinnedAt: v.optional(v.number()),
    pinnedBy: v.optional(v.id("users")),
    setupProgress: v.optional(setupProgressValidator),
    runtimeMode: v.optional(sandboxRuntimeModeValidator),
    claudeSessionId: v.optional(v.string()),
    presetId: v.optional(v.id("sandboxPresets")),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    subtaskId: v.optional(v.id("subtasks")),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    if (!canTransitionSessionStatus(session.status, args.status)) {
      throw new ConvexError(`Invalid status transition from ${session.status} to ${args.status}`);
    }

    if (args.pinnedBy) {
      const pinUser = await ctx.db.get(args.pinnedBy);
      if (!pinUser) throw new ConvexError("Pinned-by user not found");
      if (!pinUser.orgIds.includes(args.orgId)) {
        throw new ConvexError("Pinned-by user does not belong to the organization");
      }
    }

    if (args.presetId) {
      const preset = await ctx.db.get(args.presetId);
      if (!preset) throw new ConvexError("Preset not found");
      if (preset.orgId !== args.orgId) {
        throw new ConvexError("Preset does not belong to the provided organization");
      }
    }

    const patch: Record<string, unknown> = { status: args.status };
    applyOptionalPatchValue(patch, "sandboxId", args.sandboxId);
    applyOptionalPatchValue(patch, "error", args.error);
    applyOptionalPatchValue(patch, "prUrl", args.prUrl);
    applyOptionalPatchValue(patch, "prNumber", args.prNumber);
    applyOptionalPatchValue(patch, "commitSha", args.commitSha);
    applyOptionalPatchValue(patch, "filesChanged", args.filesChanged);
    applyOptionalPatchValue(patch, "tokensUsed", args.tokensUsed);
    applyOptionalPatchValue(patch, "editorType", args.editorType);
    applyOptionalPatchValue(patch, "ttlMinutes", args.ttlMinutes);
    applyOptionalPatchValue(patch, "authProvider", args.authProvider);
    applyOptionalPatchValue(patch, "isPinned", args.isPinned);
    applyOptionalPatchValue(patch, "pinnedAt", args.pinnedAt);
    applyOptionalPatchValue(patch, "pinnedBy", args.pinnedBy);
    applyOptionalPatchValue(patch, "setupProgress", args.setupProgress);
    applyOptionalPatchValue(patch, "runtimeMode", args.runtimeMode);
    applyOptionalPatchValue(patch, "claudeSessionId", args.claudeSessionId);
    applyOptionalPatchValue(patch, "presetId", args.presetId);
    applyOptionalPatchValue(patch, "subtaskId", args.subtaskId);

    if (args.runtimeMode === undefined) {
      if (args.status === "executing") {
        patch.runtimeMode = "executing";
      } else if (args.status === "sleeping") {
        patch.runtimeMode = "hibernating";
      } else if (args.status === "ready" || isTerminalSessionStatus(args.status)) {
        patch.runtimeMode = "idle";
      }
    }

    if (isTerminalSessionStatus(args.status)) {
      applyTerminalTiming(session, patch, args.completedAt, args.durationMs);
    }

    await db.patch(args.sessionId, patch);
    return args.sessionId;
  },
});

export const markComplete = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    if (!canTransitionSessionStatus(session.status, "completed")) {
      throw new ConvexError(`Invalid status transition from ${session.status} to completed`);
    }

    const patch: Record<string, unknown> = {
      status: "completed",
      runtimeMode: "idle",
    };
    applyOptionalPatchValue(patch, "prUrl", args.prUrl);
    applyOptionalPatchValue(patch, "prNumber", args.prNumber);
    applyOptionalPatchValue(patch, "commitSha", args.commitSha);
    applyOptionalPatchValue(patch, "filesChanged", args.filesChanged);
    applyOptionalPatchValue(patch, "tokensUsed", args.tokensUsed);
    applyTerminalTiming(session, patch, args.completedAt, args.durationMs);

    await db.patch(args.sessionId, patch);
    return args.sessionId;
  },
});

export const markFailed = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    error: v.string(),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    if (!canTransitionSessionStatus(session.status, "failed")) {
      throw new ConvexError(`Invalid status transition from ${session.status} to failed`);
    }

    const patch: Record<string, unknown> = {
      status: "failed",
      error: args.error,
      runtimeMode: "idle",
    };
    applyTerminalTiming(session, patch, args.completedAt, args.durationMs);

    await db.patch(args.sessionId, patch);
    return args.sessionId;
  },
});

export const getByWorktreeBranch = internalQuery({
  args: {
    worktreeBranch: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const sessions = await db
      .query("sandboxSessions")
      .withIndex("by_worktree_branch", (q: any) => q.eq("worktreeBranch", args.worktreeBranch))
      .collect();
    return (
      sessions.find(
        (s: any) =>
          s.repositoryId === args.repositoryId &&
          !["completed", "failed", "cancelled", "deleting"].includes(s.status),
      ) ?? null
    );
  },
});

export const getLatestBranchForTask = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db
      .query("sandboxSessions")
      .withIndex("by_task_started", (q: any) => q.eq("taskId", args.taskId))
      .order("desc")
      .first();
    return session?.worktreeBranch ?? null;
  },
});

export const getLatestForTaskInternal = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db
      .query("sandboxSessions")
      .withIndex("by_task_started", (q: any) => q.eq("taskId", args.taskId))
      .order("desc")
      .first();
  },
});

export const getBranchInfoForTask = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertOrgAccess(ctx, task.orgId);

    const db = ctx.db as any;
    const session = await db
      .query("sandboxSessions")
      .withIndex("by_task_started", (q: any) => q.eq("taskId", args.taskId))
      .order("desc")
      .first();

    if (!session?.worktreeBranch) return null;

    return {
      branchName: session.worktreeBranch,
      sessionStatus: session.status as string,
    };
  },
});

export const getCommitActivity = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    await assertOrgAccess(ctx, task.orgId);

    const db = ctx.db as any;

    // Get latest session for this task
    const session = await db
      .query("sandboxSessions")
      .withIndex("by_task_started", (q: any) => q.eq("taskId", args.taskId))
      .order("desc")
      .first();
    if (!session) return null;
    if (!session.worktreeBranch || !session.repositoryId) return null;

    // Get repo to build the entityId for push event lookup
    const repo = await ctx.db.get(session.repositoryId);
    if (!repo) return null;

    const repoFullName = (repo as any).repoFullName as string;
    if (!repoFullName) return null;

    // Push events have entityId = "{repoFullName}@refs/heads/{branch}"
    const pushEntityId = `${repoFullName}@refs/heads/${session.worktreeBranch}`;

    // Query sourceControlEvents by entity index
    const pushEvents = await db
      .query("sourceControlEvents")
      .withIndex("by_entity", (q: any) => q.eq("entityType", "push").eq("entityId", pushEntityId))
      .collect();

    if (pushEvents.length === 0) return null;

    // Extract commit info from push payloads
    type CommitInfo = {
      sha: string;
      message: string;
      author: string;
      timestamp: string;
      filesAdded: string[];
      filesModified: string[];
      filesRemoved: string[];
      url?: string;
    };

    const commits: CommitInfo[] = [];
    const seenShas = new Set<string>();

    for (const event of pushEvents) {
      const payload = event.payload as Record<string, any>;
      const rawCommits: Array<Record<string, any>> = payload.commits ?? [];

      for (const c of rawCommits) {
        const sha = c.id ?? "";
        if (!sha || seenShas.has(sha)) continue;
        seenShas.add(sha);
        commits.push({
          sha,
          message: (c.message ?? "").split("\n")[0].slice(0, 200),
          author: c.author?.name ?? c.author?.username ?? "unknown",
          timestamp: c.timestamp ?? "",
          filesAdded: c.added ?? [],
          filesModified: c.modified ?? [],
          filesRemoved: c.removed ?? [],
          url: c.url,
        });
      }
    }

    // Sort oldest first
    commits.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

    const totalFilesChanged = new Set([
      ...commits.flatMap((c) => c.filesAdded),
      ...commits.flatMap((c) => c.filesModified),
      ...commits.flatMap((c) => c.filesRemoved),
    ]).size;

    return {
      worktreeBranch: session.worktreeBranch as string,
      sessionStatus: session.status as string,
      commits,
      totalCommits: commits.length,
      totalFilesChanged,
      latestSha: commits.length > 0 ? commits[commits.length - 1].sha : undefined,
      compareUrl: pushEvents[0]?.payload?.compare as string | undefined,
    };
  },
});

export const updateFromWebhook = internalMutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) return;

    const patch: Record<string, unknown> = {};
    if (args.commitSha && !session.commitSha) patch.commitSha = args.commitSha;
    if (args.filesChanged != null && session.filesChanged == null) {
      patch.filesChanged = args.filesChanged;
    }

    if (Object.keys(patch).length > 0) {
      await db.patch(args.sessionId, patch);
    }
  },
});

export const updateSetupProgress = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    stage: setupProgressStageValidator,
    state: setupProgressStateValidator,
  },
  handler: async (ctx, args) => {
    const { db, session } = await getSessionForAuthorizedUser(ctx, args.sessionId);
    if (isTerminalSessionStatus(session.status)) {
      throw new ConvexError("Cannot update setup progress on a terminal session");
    }
    const current = (session.setupProgress ?? {}) as Record<string, unknown>;

    await db.patch(args.sessionId, {
      setupProgress: {
        ...current,
        [args.stage]: args.state,
      },
    });

    return args.sessionId;
  },
});

export const updateSetupProgressInternal = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    stage: setupProgressStageValidator,
    state: setupProgressStateValidator,
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    const current = (session.setupProgress ?? {}) as Record<string, unknown>;
    await db.patch(args.sessionId, {
      setupProgress: {
        ...current,
        [args.stage]: args.state,
      },
    });
    return args.sessionId;
  },
});

export const setRuntimeMode = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    runtimeMode: sandboxRuntimeModeValidator,
  },
  handler: async (ctx, args) => {
    const { db } = await getSessionForAuthorizedUser(ctx, args.sessionId);
    await db.patch(args.sessionId, { runtimeMode: args.runtimeMode });
    return args.sessionId;
  },
});

export const setRuntimeModeInternal = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    runtimeMode: sandboxRuntimeModeValidator,
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    await db.patch(args.sessionId, { runtimeMode: args.runtimeMode });
    return args.sessionId;
  },
});

export const syncLifecycleInternal = internalMutation({
  args: {
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    setupProgress: v.optional(setupProgressValidator),
    runtimeMode: v.optional(sandboxRuntimeModeValidator),
  },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) throw new ConvexError("Sandbox session not found");
    if (session.orgId !== args.orgId) {
      throw new ConvexError("Sandbox session does not belong to the provided organization");
    }

    const patch: Record<string, unknown> = {};
    if (args.setupProgress !== undefined) {
      patch.setupProgress = args.setupProgress;
    }
    if (args.runtimeMode !== undefined) {
      patch.runtimeMode = args.runtimeMode;
    }

    if (Object.keys(patch).length > 0) {
      await db.patch(args.sessionId, patch);
    }

    return args.sessionId;
  },
});

export const pin = mutation({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const { db, session, user } = await getSessionForAuthorizedUser(ctx, args.sessionId);
    if (session.isPinned) return args.sessionId;

    await db.patch(args.sessionId, {
      isPinned: true,
      pinnedAt: Date.now(),
      pinnedBy: user._id,
    });
    return args.sessionId;
  },
});

export const unpin = mutation({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const { db, session } = await getSessionForAuthorizedUser(ctx, args.sessionId);
    if (!session.isPinned) return args.sessionId;

    await db.patch(args.sessionId, {
      isPinned: false,
    });
    return args.sessionId;
  },
});

export const wake = mutation({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const { db, session } = await getSessionForAuthorizedUser(ctx, args.sessionId);

    if (!canTransitionSessionStatus(session.status, "executing")) {
      throw new ConvexError(`Invalid status transition from ${session.status} to executing`);
    }

    await db.patch(args.sessionId, {
      status: "executing",
      runtimeMode: "executing",
    });
    return args.sessionId;
  },
});

export const shutdown = mutation({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const { db, session } = await getSessionForAuthorizedUser(ctx, args.sessionId);

    if (isTerminalSessionStatus(session.status)) {
      return args.sessionId;
    }
    if (!canTransitionSessionStatus(session.status, "cancelled")) {
      throw new ConvexError(`Invalid status transition from ${session.status} to cancelled`);
    }

    const patch: Record<string, unknown> = {
      status: "cancelled",
      runtimeMode: "idle",
    };
    applyTerminalTiming(session, patch);
    await db.patch(args.sessionId, patch);
    return args.sessionId;
  },
});

// ── Chat Messages ──────────────────────────────────────────────────

/** Retrieve chat messages for a sandbox session. */
export const getChatMessages = query({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const session = await (ctx.db as any).get(args.sessionId);
    if (!session) return [];
    if (!user.orgIds.includes(session.orgId)) return [];

    return await (ctx.db as any)
      .query("chatMessages")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

/**
 * Send a chat message to a sandbox session for interactive multi-turn conversation.
 * @param sessionId - Target session
 * @param content - Message text
 * @param role - Message role (user or system)
 */
export const sendChatMessage = mutation({
  args: {
    sessionId: v.id("sandboxSessions"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("system")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    const session = await (ctx.db as any).get(args.sessionId);
    if (!session) throw new ConvexError("Session not found");
    if (!user.orgIds.includes(session.orgId)) throw new ConvexError("Access denied");

    const messageId = await (ctx.db as any).insert("chatMessages", {
      sessionId: args.sessionId,
      orgId: session.orgId,
      role: args.role,
      content: args.content,
      status: "sent",
      createdAt: Date.now(),
    });

    // Deliver user messages to the sandbox worker when the session is active.
    // Interactive sessions may be in "ready" state between executions.
    const canDeliver =
      session.status === "executing" ||
      (session.runtimeMode === "interactive" && !isTerminalSessionStatus(session.status));
    if (args.role === "user" && canDeliver && session.sandboxId) {
      await ctx.scheduler.runAfter(0, internalApi.sandbox.sessions.deliverChatMessage, {
        sandboxId: session.sandboxId,
        messageId,
        content: args.content,
      });
    }

    return messageId;
  },
});

/**
 * Delivers a chat message to the sandbox worker's interactive session.
 * Called via scheduler from sendChatMessage when a session is executing.
 */
export const deliverChatMessage = internalAction({
  args: {
    sandboxId: v.string(),
    messageId: v.id("chatMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const workerUrl = process.env.SANDBOX_WORKER_URL?.trim();
    const apiSecret = process.env.SANDBOX_API_SECRET?.trim();
    if (!workerUrl || !apiSecret) return;

    const url = `${workerUrl.replace(/\/+$/, "")}/sandbox/${encodeURIComponent(args.sandboxId)}/message`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiSecret}`,
        },
        body: JSON.stringify({ content: args.content }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`Failed to deliver message to worker: ${response.status}`);
      }

      // Update message status to "complete" after successful delivery
      await ctx.runMutation(internalApi.sandbox.sessions.updateChatMessageStatus, {
        messageId: args.messageId,
        status: response.ok ? "complete" : "error",
        error: response.ok ? undefined : `Worker returned ${response.status}`,
      });
    } catch (err) {
      console.warn("Failed to deliver chat message:", err);
      await ctx.runMutation(internalApi.sandbox.sessions.updateChatMessageStatus, {
        messageId: args.messageId,
        status: "error" as const,
        error: err instanceof Error ? err.message : "Network error delivering message",
      });
    }
  },
});

// ── Delete Operations ───────────────────────────────────────────────

/**
 * Internal mutation that cascade-deletes a single session and its related data
 * using paginated reads to stay within Convex's 4096 read limit.
 * Self-reschedules if more data remains.
 */
export const _cascadeDeleteSession = internalMutation({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    const session = await db.get(args.sessionId);
    if (!session) return;

    // Paginated cascade-delete sandboxLogs (200 at a time)
    const logs = await db
      .query("sandboxLogs")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .take(200);
    for (const log of logs) {
      await db.delete(log._id);
    }
    if (logs.length === 200) {
      await ctx.scheduler.runAfter(0, internalApi.sandbox.sessions._cascadeDeleteSession, {
        sessionId: args.sessionId,
      });
      return;
    }

    // Paginated cascade-delete chatMessages (200 at a time)
    const messages = await db
      .query("chatMessages")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .take(200);
    for (const message of messages) {
      await db.delete(message._id);
    }
    if (messages.length === 200) {
      await ctx.scheduler.runAfter(0, internalApi.sandbox.sessions._cascadeDeleteSession, {
        sessionId: args.sessionId,
      });
      return;
    }

    // All related data cleared — delete the session itself
    await db.delete(args.sessionId);
  },
});

/** Permanently delete a sandbox session and its associated logs and chat messages. */
export const deleteSession = mutation({
  args: { sessionId: v.id("sandboxSessions") },
  handler: async (ctx, args) => {
    const { db, session } = await getSessionForAuthorizedUser(ctx, args.sessionId);

    if (!isTerminalSessionStatus(session.status)) {
      throw new ConvexError(
        `Cannot delete session in "${session.status}" status. Terminate it first.`,
      );
    }

    await db.patch(args.sessionId, { status: "deleting" });

    // Destroy the container before cleaning up DB records
    await ctx.scheduler.runAfter(0, internalApi.sandbox.orchestrator.cleanup, {
      sessionId: args.sessionId,
    });

    await ctx.scheduler.runAfter(0, internalApi.sandbox.sessions._cascadeDeleteSession, {
      sessionId: args.sessionId,
    });
    return args.sessionId;
  },
});

export const bulkDeleteSessions = mutation({
  args: { sessionIds: v.array(v.id("sandboxSessions")) },
  handler: async (ctx, args) => {
    if (args.sessionIds.length > 50) {
      throw new ConvexError("Cannot delete more than 50 sessions at once.");
    }

    const user = await getAuthUser(ctx);
    const db = ctx.db as any;
    let scheduled = 0;
    let skipped = 0;

    for (const sessionId of args.sessionIds) {
      const session = await db.get(sessionId);
      if (
        !session ||
        !user.orgIds.includes(session.orgId) ||
        !isTerminalSessionStatus(session.status) ||
        session.status === "deleting"
      ) {
        skipped++;
        continue;
      }

      await db.patch(sessionId, { status: "deleting" });

      // Destroy the container before cleaning up DB records
      await ctx.scheduler.runAfter(0, internalApi.sandbox.orchestrator.cleanup, {
        sessionId,
      });

      await ctx.scheduler.runAfter(0, internalApi.sandbox.sessions._cascadeDeleteSession, {
        sessionId,
      });
      scheduled++;
    }

    return { deleted: scheduled, skipped };
  },
});

export const updateChatMessageStatus = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    status: v.union(
      v.literal("sent"),
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await (ctx.db as any).patch(args.messageId, {
      status: args.status,
      ...(args.error ? { error: args.error } : {}),
    });
  },
});
