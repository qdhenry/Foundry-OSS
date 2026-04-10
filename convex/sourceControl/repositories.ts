import { v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

const internalApi: any = (generatedApi as any).internal;

/**
 * Repository binding management.
 *
 * Connects/disconnects GitHub repositories to programs, manages path filters,
 * roles, and deploy workflow tagging.
 */

/**
 * Connect a GitHub repository to a program and trigger initial sync.
 * @param programId - Target program
 * @param repoFullName - Full repository name (owner/repo)
 */
export const connectRepository = mutation({
  args: {
    programId: v.id("programs"),
    installationId: v.string(),
    repoFullName: v.string(),
    providerRepoId: v.string(),
    defaultBranch: v.string(),
    language: v.optional(v.string()),
    role: v.union(
      v.literal("storefront"),
      v.literal("integration"),
      v.literal("data_migration"),
      v.literal("infrastructure"),
      v.literal("extension"),
      v.literal("documentation"),
    ),
    isMonorepo: v.boolean(),
    pathFilters: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // 1. Validate org access via program
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // 2. Verify installation is active for this org
    const installation = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();
    if (!installation || installation.status !== "active") {
      throw new Error("Installation not found or not active");
    }
    if (installation.orgId !== program.orgId) {
      throw new Error("Installation does not belong to this organization");
    }

    // 3. Check for existing binding (no duplicate repos per program)
    const existing = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .filter((q) => q.eq(q.field("repoFullName"), args.repoFullName))
      .first();
    if (existing) {
      throw new Error(`Repository ${args.repoFullName} is already connected to this program`);
    }

    // 4. Create sourceControlRepositories record
    const repoId = await ctx.db.insert("sourceControlRepositories", {
      orgId: program.orgId,
      programId: args.programId,
      installationId: args.installationId,
      providerType: "github",
      repoFullName: args.repoFullName,
      providerRepoId: args.providerRepoId,
      defaultBranch: args.defaultBranch,
      language: args.language,
      role: args.role,
      isMonorepo: args.isMonorepo,
      pathFilters: args.pathFilters,
    });

    // 5. Create initial sourceControlSyncState record
    await ctx.db.insert("sourceControlSyncState", {
      orgId: program.orgId,
      repositoryId: repoId,
      reconciliationCorrections: 0,
      status: "healthy",
    });

    // 6. Schedule initial 90-day sync
    await ctx.scheduler.runAfter(
      0,
      internalApi.sourceControl.sync.initialSyncActions.runInitialSync,
      { repositoryId: repoId },
    );

    return repoId;
  },
});

/** Disconnect a repository from its program. Preserves historical data. */
export const disconnectRepository = mutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new Error("Repository not found");
    await assertOrgAccess(ctx, repo.orgId);

    // Update sync state to mark disconnected
    const syncState = await ctx.db
      .query("sourceControlSyncState")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
      .unique();

    if (syncState) {
      await ctx.db.patch(syncState._id, { status: "error" });
    }

    // Delete the repository binding (data in PRs, commits, etc. is preserved)
    await ctx.db.delete(args.repositoryId);
  },
});

// ---------------------------------------------------------------------------
// listByProgram — list all repos for a program with sync health
// ---------------------------------------------------------------------------

/** List repositories connected to a program with enriched installation details. */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const repos = await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Join with sync state for each repo
    const results = await Promise.all(
      repos.map(async (repo) => {
        const syncState = await ctx.db
          .query("sourceControlSyncState")
          .withIndex("by_repo", (q) => q.eq("repositoryId", repo._id))
          .unique();

        return {
          ...repo,
          syncStatus: syncState?.status ?? "healthy",
          lastWebhookAt: syncState?.lastWebhookAt ?? null,
          lastReconciliationAt: syncState?.lastReconciliationAt ?? null,
        };
      }),
    );

    return results;
  },
});

// ---------------------------------------------------------------------------
// updatePathFilters — update monorepo glob patterns
// ---------------------------------------------------------------------------

export const updatePathFilters = mutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    pathFilters: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new Error("Repository not found");
    await assertOrgAccess(ctx, repo.orgId);

    await ctx.db.patch(args.repositoryId, {
      pathFilters: args.pathFilters,
      isMonorepo: args.pathFilters.length > 0,
    });
  },
});

// ---------------------------------------------------------------------------
// setLocalPath — set local workspace path for a repository binding
// ---------------------------------------------------------------------------

export const setLocalPath = mutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    localPath: v.string(),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new Error("Repository not found");
    await assertOrgAccess(ctx, repo.orgId);

    await ctx.db.patch(args.repositoryId, {
      localPath: args.localPath,
    });
  },
});

// ---------------------------------------------------------------------------
// updateRepositoryRole — assign role to a repository
// ---------------------------------------------------------------------------

export const updateRepositoryRole = mutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    role: v.union(
      v.literal("storefront"),
      v.literal("integration"),
      v.literal("data_migration"),
      v.literal("infrastructure"),
      v.literal("extension"),
      v.literal("documentation"),
    ),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new Error("Repository not found");
    await assertOrgAccess(ctx, repo.orgId);

    await ctx.db.patch(args.repositoryId, { role: args.role });
  },
});

// ---------------------------------------------------------------------------
// tagDeployWorkflows — mark which GitHub Actions workflows are deployments
// ---------------------------------------------------------------------------

export const tagDeployWorkflows = mutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    deployWorkflowNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) throw new Error("Repository not found");
    await assertOrgAccess(ctx, repo.orgId);

    await ctx.db.patch(args.repositoryId, {
      deployWorkflowNames: args.deployWorkflowNames,
    });
  },
});

// ---------------------------------------------------------------------------
// getInstallation — get installation details (public query)
// ---------------------------------------------------------------------------

/** Look up a GitHub App installation by its installation ID. */
export const getInstallation = query({
  args: { installationId: v.string() },
  handler: async (ctx, args) => {
    const installation = await ctx.db
      .query("sourceControlInstallations")
      .withIndex("by_installation", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (!installation) return null;
    await assertOrgAccess(ctx, installation.orgId);

    return installation;
  },
});

// ---------------------------------------------------------------------------
// getByIdInternal — internal query for initial sync
// ---------------------------------------------------------------------------

export const getByIdInternal = internalQuery({
  args: { repositoryId: v.id("sourceControlRepositories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.repositoryId);
  },
});

// ---------------------------------------------------------------------------
// listByProgramInternal — internal query for AI context assembly
// ---------------------------------------------------------------------------

export const listByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// getRepoDetailsInternal — fetch multiple repos by ID (used by analysis action)
// ---------------------------------------------------------------------------

export const getRepoDetailsInternal = internalQuery({
  args: { repositoryIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const repos = [];
    for (const id of args.repositoryIds) {
      const repo = await ctx.db.get(id as any);
      if (repo) repos.push(repo);
    }
    return repos;
  },
});

// ---------------------------------------------------------------------------
// getByFullNameInternal — look up a repo by its full name (owner/repo)
// ---------------------------------------------------------------------------

export const getByFullNameInternal = internalQuery({
  args: { repoFullName: v.string(), orgId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.orgId) {
      // Tenant-scoped lookup: find repo belonging to this org
      const repos = await ctx.db
        .query("sourceControlRepositories")
        .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
        .collect();
      return repos.find((r) => r.orgId === args.orgId) ?? null;
    }
    return await ctx.db
      .query("sourceControlRepositories")
      .withIndex("by_repo", (q) => q.eq("repoFullName", args.repoFullName))
      .first();
  },
});
