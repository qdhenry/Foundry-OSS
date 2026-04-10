// @ts-nocheck
import { v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";
import { internalMutation, internalQuery, query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";
import { mapEnvironment } from "./environmentMapping";

/**
 * Deployment event processing.
 *
 * Handles deployment and deployment_status webhook events, as well as
 * user-tagged GitHub Actions workflow_run events treated as deployments.
 */

// ---------------------------------------------------------------------------
// processDeploymentEvent — create or update a deployment from webhook data
// ---------------------------------------------------------------------------

export const processDeploymentEvent = internalMutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    programId: v.id("programs"),
    rawEnvironment: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("success"),
      v.literal("failure"),
      v.literal("error"),
      v.literal("inactive"),
    ),
    sha: v.string(),
    ref: v.string(),
    providerDeploymentId: v.optional(v.number()),
    deployedBy: v.optional(v.string()),
    deployedAt: v.number(),
    completedAt: v.optional(v.number()),
    workflowRunId: v.optional(v.number()),
    workflowName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get repo for orgId
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) return;

    // Normalize environment name
    const environment = mapEnvironment(args.rawEnvironment);

    // Check if this is a user-tagged deploy workflow
    if (args.workflowName && repo.deployWorkflowNames) {
      const isTagged = repo.deployWorkflowNames.includes(args.workflowName);
      if (!isTagged && !args.providerDeploymentId) {
        // Workflow run that isn't tagged as a deployment — skip
        return;
      }
    }

    // Check for existing deployment to update (by providerDeploymentId or SHA+env)
    let existingDeployment: Doc<"sourceControlDeployments"> | null = null;

    if (args.providerDeploymentId) {
      // Look up by SHA (we can't index by providerDeploymentId, but SHA+env is unique enough)
      const candidates = await ctx.db
        .query("sourceControlDeployments")
        .withIndex("by_sha", (q) => q.eq("sha", args.sha))
        .collect();
      existingDeployment =
        candidates.find(
          (d) =>
            d.repositoryId === args.repositoryId &&
            d.providerDeploymentId === args.providerDeploymentId,
        ) ?? null;
    }

    if (existingDeployment) {
      // Update existing deployment (e.g., deployment_status update)
      const updates: Partial<Doc<"sourceControlDeployments">> = {
        status: args.status,
      };
      if (args.completedAt) {
        updates.completedAt = args.completedAt;
        if (existingDeployment.deployedAt) {
          updates.durationMs = args.completedAt - existingDeployment.deployedAt;
        }
      }
      await ctx.db.patch(existingDeployment._id, updates);
      return existingDeployment._id;
    }

    // Create new deployment record
    const deploymentId = await ctx.db.insert("sourceControlDeployments", {
      orgId: repo.orgId,
      repositoryId: args.repositoryId,
      programId: args.programId,
      environment,
      rawEnvironment: args.rawEnvironment,
      status: args.status,
      sha: args.sha,
      ref: args.ref,
      providerDeploymentId: args.providerDeploymentId,
      deployedBy: args.deployedBy,
      deployedAt: args.deployedAt,
      completedAt: args.completedAt,
      workflowRunId: args.workflowRunId,
      workflowName: args.workflowName,
      durationMs: args.completedAt ? args.completedAt - args.deployedAt : undefined,
    });

    return deploymentId;
  },
});

// ---------------------------------------------------------------------------
// processWorkflowRun — handle workflow_run events for deploy-tagged workflows
// ---------------------------------------------------------------------------

export const processWorkflowRun = internalMutation({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    programId: v.id("programs"),
    workflowName: v.string(),
    workflowRunId: v.number(),
    status: v.string(),
    conclusion: v.optional(v.string()),
    sha: v.string(),
    ref: v.string(),
    actor: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo) return;

    // Only process if workflow is tagged as a deployment
    if (!repo.deployWorkflowNames?.includes(args.workflowName)) {
      return;
    }

    // Map workflow conclusion to deployment status
    let deployStatus: "pending" | "in_progress" | "success" | "failure" | "error" | "inactive";
    if (args.status === "completed") {
      switch (args.conclusion) {
        case "success":
          deployStatus = "success";
          break;
        case "failure":
        case "timed_out":
          deployStatus = "failure";
          break;
        case "cancelled":
          deployStatus = "inactive";
          break;
        default:
          deployStatus = "error";
      }
    } else if (args.status === "in_progress") {
      deployStatus = "in_progress";
    } else {
      deployStatus = "pending";
    }

    // Use workflow name as environment hint, or "production" as default
    // Users can customize this via environment mapping in program settings
    const rawEnvironment = args.workflowName;
    const environment = mapEnvironment(rawEnvironment);

    // Check for existing deployment from this workflow run
    const candidates = await ctx.db
      .query("sourceControlDeployments")
      .withIndex("by_sha", (q) => q.eq("sha", args.sha))
      .collect();
    const existing = candidates.find(
      (d) => d.repositoryId === args.repositoryId && d.workflowRunId === args.workflowRunId,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: deployStatus,
        completedAt: args.completedAt,
        durationMs: args.completedAt ? args.completedAt - existing.deployedAt : undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("sourceControlDeployments", {
      orgId: repo.orgId,
      repositoryId: args.repositoryId,
      programId: args.programId,
      environment,
      rawEnvironment,
      status: deployStatus,
      sha: args.sha,
      ref: args.ref,
      deployedBy: args.actor,
      deployedAt: args.startedAt,
      completedAt: args.completedAt,
      workflowRunId: args.workflowRunId,
      workflowName: args.workflowName,
      durationMs: args.completedAt ? args.completedAt - args.startedAt : undefined,
    });
  },
});

// ---------------------------------------------------------------------------
// listByProgram — list deployments for a program (public, auth-checked)
// ---------------------------------------------------------------------------

export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    environment: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) return [];
    await assertOrgAccess(ctx, program.orgId);

    const maxResults = args.limit ?? 50;

    let deployments;
    if (args.environment) {
      deployments = await ctx.db
        .query("sourceControlDeployments")
        .withIndex("by_program_env", (q) =>
          q.eq("programId", args.programId).eq("environment", args.environment!),
        )
        .collect();
    } else {
      // Get deployments across all environments for this program
      const repos = await ctx.db
        .query("sourceControlRepositories")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect();

      deployments = [];
      for (const repo of repos) {
        const repoDeploys = await ctx.db
          .query("sourceControlDeployments")
          .withIndex("by_repo", (q) => q.eq("repositoryId", repo._id))
          .collect();
        deployments.push(...repoDeploys);
      }
    }

    // Sort by deployedAt descending, limit results
    deployments.sort((a, b) => b.deployedAt - a.deployedAt);
    return deployments.slice(0, maxResults);
  },
});

// ---------------------------------------------------------------------------
// getLatestDeployment — get the most recent deployment for an env (internal)
// ---------------------------------------------------------------------------

export const getLatestDeployment = internalQuery({
  args: {
    programId: v.id("programs"),
    environment: v.string(),
  },
  handler: async (ctx, args) => {
    const deployments = await ctx.db
      .query("sourceControlDeployments")
      .withIndex("by_program_env", (q) =>
        q.eq("programId", args.programId).eq("environment", args.environment),
      )
      .collect();

    if (deployments.length === 0) return null;

    // Return most recent
    return deployments.sort((a, b) => b.deployedAt - a.deployedAt)[0];
  },
});

// ---------------------------------------------------------------------------
// getPreviousSuccessfulDeployment — for PR detection SHA walking
// ---------------------------------------------------------------------------

export const getPreviousSuccessfulDeployment = internalQuery({
  args: {
    repositoryId: v.id("sourceControlRepositories"),
    environment: v.string(),
    beforeDeploymentId: v.id("sourceControlDeployments"),
  },
  handler: async (ctx, args) => {
    const current = await ctx.db.get(args.beforeDeploymentId);
    if (!current) return null;

    const deployments = await ctx.db
      .query("sourceControlDeployments")
      .withIndex("by_repo", (q) => q.eq("repositoryId", args.repositoryId))
      .collect();

    // Find the most recent successful deployment before the current one
    const previousSuccessful = deployments
      .filter(
        (d) =>
          d.environment === args.environment &&
          d.status === "success" &&
          d.deployedAt < current.deployedAt,
      )
      .sort((a, b) => b.deployedAt - a.deployedAt);

    return previousSuccessful.length > 0 ? previousSuccessful[0] : null;
  },
});

// ---------------------------------------------------------------------------
// updateDeploymentPRs — store detected PR/task mappings on deployment
// ---------------------------------------------------------------------------

export const updateDeploymentPRs = internalMutation({
  args: {
    deploymentId: v.id("sourceControlDeployments"),
    relatedPRNumbers: v.array(v.number()),
    relatedTaskIds: v.array(v.id("tasks")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.deploymentId, {
      relatedPRNumbers: args.relatedPRNumbers,
      relatedTaskIds: args.relatedTaskIds,
    });
  },
});
