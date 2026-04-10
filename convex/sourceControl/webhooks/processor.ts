// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";

/**
 * Async event processor — scheduled immediately after webhook receipt.
 *
 * Flow:
 * 1. Load event from sourceControlEvents
 * 2. Set status to "processing"
 * 3. Check path filters for monorepo events
 * 4. Route to handler by event type
 * 5. Set status to "processed" on success
 * 6. On failure: increment retryCount, schedule retry with exponential backoff
 */

const MAX_EVENT_RETRIES = 5;

export const processEvent = internalAction({
  args: { eventId: v.id("sourceControlEvents") },
  handler: async (ctx, args) => {
    // 1. Load event
    const event = await ctx.runQuery(internal.sourceControl.webhooks.handler.getEventById, {
      eventId: args.eventId,
    });
    if (!event) {
      console.error(`Event ${args.eventId} not found`);
      return;
    }

    // Skip already-processed or abandoned events
    if (event.status === "processed" || event.status === "filtered") {
      return;
    }

    // 2. Mark as processing
    await ctx.runMutation(internal.sourceControl.webhooks.handler.updateEventStatus, {
      eventId: args.eventId,
      status: "processing",
    });

    try {
      const payload = event.payload as Record<string, any>;
      const repoFullName: string | null = payload.repository?.full_name ?? null;

      // 3. Check path filters for monorepo scoping
      if (repoFullName) {
        const shouldFilter = await checkPathFilters(ctx, repoFullName, event.eventType, payload);
        if (shouldFilter) {
          await ctx.runMutation(internal.sourceControl.webhooks.handler.updateEventStatus, {
            eventId: args.eventId,
            status: "filtered",
            processedAt: Date.now(),
          });
          return;
        }
      }

      // 4. Route to handler by event type
      await routeEvent(ctx, event.eventType, event.action ?? null, payload, event.orgId);

      // 5. Mark as processed
      await ctx.runMutation(internal.sourceControl.webhooks.handler.updateEventStatus, {
        eventId: args.eventId,
        status: "processed",
        processedAt: Date.now(),
      });

      // Update sync state
      if (repoFullName) {
        await ctx.runMutation(internal.sourceControl.webhooks.handler.updateSyncStateWebhook, {
          repoFullName,
        });
      }
    } catch (error) {
      console.error(
        `Event processing failed for ${args.eventId}:`,
        error instanceof Error ? error.message : error,
      );

      const newRetryCount = event.retryCount + 1;

      if (newRetryCount >= MAX_EVENT_RETRIES) {
        // Exhausted retries — mark as permanently failed
        await ctx.runMutation(internal.sourceControl.webhooks.handler.updateEventStatus, {
          eventId: args.eventId,
          status: "failed",
          retryCount: newRetryCount,
        });
      } else {
        // Schedule retry with exponential backoff
        const delayMs = Math.min(2 ** newRetryCount * 1000, 3600000);
        await ctx.runMutation(internal.sourceControl.webhooks.handler.updateEventStatus, {
          eventId: args.eventId,
          status: "pending",
          retryCount: newRetryCount,
        });
        await ctx.scheduler.runAfter(
          delayMs,
          internal.sourceControl.webhooks.processor.processEvent,
          { eventId: args.eventId },
        );
      }
    }
  },
});

// ---------------------------------------------------------------------------
// checkPathFilters — returns true if the event should be filtered out
// ---------------------------------------------------------------------------

async function checkPathFilters(
  ctx: any,
  repoFullName: string,
  eventType: string,
  payload: Record<string, any>,
): Promise<boolean> {
  // Only filter path-relevant events
  if (!["push", "pull_request"].includes(eventType)) {
    return false;
  }

  // Look up all bindings for this repo (could be bound multiple times for monorepo)
  const repos = await ctx.runQuery(internal.sourceControl.webhooks.handler.getReposByFullName, {
    repoFullName,
  });

  // If no repo has path filters, don't filter
  const monorepoBindings = repos.filter(
    (r: any) => r.isMonorepo && r.pathFilters && r.pathFilters.length > 0,
  );
  if (monorepoBindings.length === 0) return false;

  // Extract changed files from the event
  const changedFiles = extractChangedFiles(eventType, payload);
  if (changedFiles.length === 0) return false;

  // Check if any changed file matches any path filter
  for (const binding of monorepoBindings) {
    for (const file of changedFiles) {
      for (const filter of binding.pathFilters) {
        if (matchesGlobPattern(file, filter)) {
          return false; // At least one file matches — process this event
        }
      }
    }
  }

  // No files matched any path filter — filter out
  return true;
}

function extractChangedFiles(eventType: string, payload: Record<string, any>): string[] {
  if (eventType === "push") {
    const commits: Array<Record<string, any>> = payload.commits ?? [];
    const files = new Set<string>();
    for (const commit of commits) {
      for (const f of commit.added ?? []) files.add(f);
      for (const f of commit.removed ?? []) files.add(f);
      for (const f of commit.modified ?? []) files.add(f);
    }
    return Array.from(files);
  }

  if (eventType === "pull_request") {
    // PR webhook doesn't include file list — can't filter at webhook time
    // Files would need a separate API call, so don't filter PRs by path
    return [];
  }

  return [];
}

function matchesGlobPattern(filePath: string, pattern: string): boolean {
  // Simple glob matching for common patterns like "src/storefront/**"
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(filePath);
}

// ---------------------------------------------------------------------------
// routeEvent — dispatch to the correct handler based on event type
// ---------------------------------------------------------------------------

async function routeEvent(
  ctx: any,
  eventType: string,
  action: string | null,
  payload: Record<string, any>,
  orgId: string,
): Promise<void> {
  switch (eventType) {
    case "push":
      await handlePushEvent(ctx, payload, orgId);
      break;

    case "pull_request":
      await handlePullRequestEvent(ctx, action, payload, orgId);
      break;

    case "issues":
      await handleIssuesEvent(ctx, action, payload);
      break;

    case "pull_request_review":
      await handlePullRequestReviewEvent(ctx, action, payload, orgId);
      break;

    case "deployment":
    case "deployment_status":
      await handleDeploymentEvent(ctx, eventType, action, payload, orgId);
      break;

    case "workflow_run":
      await handleWorkflowRunEvent(ctx, action, payload, orgId);
      break;

    case "issue_comment":
      await handleIssueCommentEvent(ctx, action, payload);
      break;

    case "installation":
      await handleInstallationEvent(ctx, action, payload, orgId);
      break;

    case "repository":
      await handleRepositoryEvent(ctx, action, payload);
      break;

    default:
      console.log(`[webhook] Unhandled event type: ${eventType}.${action}`);
  }
}

// ---------------------------------------------------------------------------
// handleInstallationEvent — create/update installation records
// ---------------------------------------------------------------------------

async function handleInstallationEvent(
  ctx: any,
  action: string | null,
  payload: Record<string, any>,
  _orgId: string,
): Promise<void> {
  const installationId = String(payload.installation?.id ?? "");
  if (!installationId) return;

  if (action === "created" || action === "new_permissions_accepted") {
    await ctx.runMutation(internal.sourceControl.installations.handleInstallation, {
      installationId,
      accountLogin: payload.installation?.account?.login ?? "",
      accountType:
        payload.installation?.account?.type === "Organization"
          ? ("organization" as const)
          : ("user" as const),
      permissions: payload.installation?.permissions ?? {},
    });
  } else if (action === "deleted" || action === "suspend") {
    await ctx.runMutation(internal.sourceControl.installations.handleUninstall, { installationId });
  }
}

// ---------------------------------------------------------------------------
// handleIssuesEvent — route issue webhook events to task sync (6B/6C)
// ---------------------------------------------------------------------------

async function handleIssuesEvent(
  ctx: any,
  action: string | null,
  payload: Record<string, any>,
): Promise<void> {
  const repoFullName: string = payload.repository?.full_name ?? "";
  const issueNumber: number = payload.issue?.number ?? 0;
  if (!repoFullName || !issueNumber) return;

  const handledActions = ["closed", "reopened", "assigned", "labeled", "edited"];

  if (!action || !handledActions.includes(action)) {
    console.log(`[webhook] issues.${action} for #${issueNumber} — no handler`);
    return;
  }

  await ctx.runMutation(internal.sourceControl.tasks.issueSync.updateTaskFromIssueEvent, {
    repoFullName,
    issueNumber,
    action,
    payload,
  });

  // If an issue was closed or reopened, also update the parent issue progress
  if (action === "closed" || action === "reopened") {
    // Look up the task to find its workstream/sprint for parent issue update
    const repo = await ctx.runQuery(internal.sourceControl.tasks.issueSync.getRepoByFullName, {
      repoFullName,
    });
    if (repo) {
      const mapping = await ctx.runQuery(
        internal.sourceControl.tasks.issueSync.getIssueMappingByIssue,
        { repositoryId: repo._id, issueNumber },
      );
      if (mapping) {
        const taskContext = await ctx.runQuery(
          internal.sourceControl.tasks.issueSync.getTaskSyncContext,
          { taskId: mapping.taskId },
        );
        if (taskContext.workstream && taskContext.sprint) {
          await ctx.runAction(
            internal.sourceControl.tasks.dependencySyncActions.updateParentIssueProgress,
            {
              workstreamId: taskContext.workstream._id,
              sprintId: taskContext.sprint._id,
              repositoryId: repo._id,
            },
          );
        }
      }
    }
  }

  // If the body edit caused a conflict, schedule conflict resolution
  if (action === "edited" && payload.changes?.body) {
    const repo = await ctx.runQuery(internal.sourceControl.tasks.issueSync.getRepoByFullName, {
      repoFullName,
    });
    if (repo) {
      const mapping = await ctx.runQuery(
        internal.sourceControl.tasks.issueSync.getIssueMappingByIssue,
        { repositoryId: repo._id, issueNumber },
      );
      if (mapping && mapping.syncStatus === "conflict") {
        await ctx.runAction(internal.sourceControl.tasks.issueSyncActions.resolveConflict, {
          taskId: mapping.taskId,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// handleIssueCommentEvent — check for /migration-review command (6C)
// ---------------------------------------------------------------------------

async function handleIssueCommentEvent(
  ctx: any,
  action: string | null,
  payload: Record<string, any>,
): Promise<void> {
  if (action !== "created") return;

  const repoFullName: string = payload.repository?.full_name ?? "";
  const issueNumber: number = payload.issue?.number ?? 0;
  const commentBody: string = payload.comment?.body ?? "";
  const commentAuthor: string = payload.comment?.user?.login ?? "";

  if (!repoFullName || !issueNumber || !commentBody) return;

  const result = await ctx.runMutation(internal.sourceControl.tasks.issueSync.handleIssueComment, {
    repoFullName,
    issueNumber,
    commentBody,
    commentAuthor,
  });

  if (result?.shouldTriggerReview && result.prId) {
    await ctx.scheduler.runAfter(
      0,
      internal.sourceControl.reviews.migrationReviewActions.requestMigrationReview,
      {
        prId: result.prId,
        requestedBy: commentAuthor,
        triggerMethod: "github_comment" as const,
      },
    );
    console.log(
      `[webhook] /migration-review command by ${commentAuthor} on #${issueNumber} — review scheduled for PR ${result.prId}`,
    );
  }
}

// ---------------------------------------------------------------------------
// handlePullRequestEvent — create/update PR records, trigger task linking (6D)
// ---------------------------------------------------------------------------

async function handlePullRequestEvent(
  ctx: any,
  action: string | null,
  payload: Record<string, any>,
  orgId: string,
): Promise<void> {
  const pr = payload.pull_request;
  const repoFullName: string = payload.repository?.full_name ?? "";
  if (!pr || !repoFullName) return;

  const handledActions = [
    "opened",
    "synchronize",
    "edited",
    "closed",
    "reopened",
    "converted_to_draft",
    "ready_for_review",
  ];
  if (!action || !handledActions.includes(action)) return;

  // Determine PR state
  let state: "open" | "closed" | "merged" = "open";
  if (pr.merged) {
    state = "merged";
  } else if (pr.state === "closed") {
    state = "closed";
  }

  // Upsert the PR record
  const prId = await ctx.runMutation(internal.sourceControl.tasks.prTracking.upsertPR, {
    orgId,
    repoFullName,
    prNumber: pr.number,
    title: pr.title,
    body: pr.body ?? undefined,
    state,
    isDraft: pr.draft ?? false,
    authorLogin: pr.user?.login ?? "unknown",
    sourceBranch: pr.head?.ref ?? "",
    targetBranch: pr.base?.ref ?? "",
    commitCount: pr.commits ?? 0,
    filesChanged: pr.changed_files ?? 0,
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    createdAt: new Date(pr.created_at).getTime(),
    updatedAt: new Date(pr.updated_at).getTime(),
    mergedAt: pr.merged_at ? new Date(pr.merged_at).getTime() : undefined,
    providerUrl: pr.html_url ?? "",
  });

  // After creating/updating a PR, try deterministic task linking
  if (prId && (action === "opened" || action === "edited" || action === "synchronize")) {
    await ctx.runMutation(internal.sourceControl.tasks.prLinking.tryDeterministicLink, { prId });
  }

  // Sync conflict state from mergeable_state on synchronize events
  if (prId && action === "synchronize" && pr.mergeable_state) {
    await ctx.runMutation(internal.sourceControl.tasks.prTracking.syncConflictState, {
      prId,
      mergeableState: pr.mergeable_state,
      conflictFiles: [],
    });
  }

  // Auto-advance linked task to "done" when a PR merges
  if (prId && action === "closed" && pr.merged === true) {
    await ctx.runMutation(internal.sourceControl.tasks.prTracking.advanceTaskOnMerge, { prId });
  }

  // Emit activity event for key PR state transitions
  if (prId) {
    const actorLogin: string = pr.user?.login ?? payload.sender?.login ?? "unknown";
    const now = Date.now();

    let eventType:
      | "pr_created"
      | "pr_merged"
      | "pr_closed"
      | "pr_reopened"
      | "pr_converted_to_draft"
      | "pr_ready_for_review"
      | null = null;

    if (action === "opened") eventType = "pr_created";
    else if (action === "closed" && pr.merged) eventType = "pr_merged";
    else if (action === "closed" && !pr.merged) eventType = "pr_closed";
    else if (action === "reopened") eventType = "pr_reopened";
    else if (action === "converted_to_draft") eventType = "pr_converted_to_draft";
    else if (action === "ready_for_review") eventType = "pr_ready_for_review";

    if (eventType) {
      // Look up linked task for the event (prId is now stored, need to fetch it)
      const prRecord = await ctx.runQuery(internal.sourceControl.tasks.prTracking.getPRById, {
        prId,
      });
      await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
        orgId,
        taskId: prRecord?.taskId,
        prId,
        eventType,
        actorLogin,
        summary: buildPREventSummary(eventType, pr.number, pr.title),
        metadata: { prNumber: pr.number, state, isDraft: pr.draft ?? false },
        occurredAt: now,
      });
    }
  }

  console.log(
    `[webhook] pull_request.${action} — PR #${pr.number} on ${repoFullName} (state: ${state})`,
  );
}

// ---------------------------------------------------------------------------
// handlePullRequestReviewEvent — update review state on PRs (6D)
// ---------------------------------------------------------------------------

async function handlePullRequestReviewEvent(
  ctx: any,
  action: string | null,
  payload: Record<string, any>,
  orgId: string,
): Promise<void> {
  if (action !== "submitted") return;

  const review = payload.review;
  const pr = payload.pull_request;
  const repoFullName: string = payload.repository?.full_name ?? "";
  if (!review || !pr || !repoFullName) return;

  // Map GitHub review state to our enum
  const ghState: string = review.state?.toLowerCase() ?? "";
  let reviewState: "none" | "pending" | "approved" | "changes_requested" = "none";
  if (ghState === "approved") {
    reviewState = "approved";
  } else if (ghState === "changes_requested") {
    reviewState = "changes_requested";
  } else if (ghState === "pending") {
    reviewState = "pending";
  }

  await ctx.runMutation(internal.sourceControl.tasks.prTracking.updateReviewState, {
    orgId,
    repoFullName,
    prNumber: pr.number,
    reviewState,
  });

  // Emit activity event for review submission
  const repo = await ctx.runQuery(internal.sourceControl.webhooks.handler.getReposByFullName, {
    repoFullName,
  });
  if (repo.length > 0) {
    const prRecord = await ctx.runQuery(
      internal.sourceControl.tasks.prTracking.getPRByRepoAndNumber,
      { repoFullName, prNumber: pr.number },
    );
    if (prRecord) {
      await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
        orgId,
        taskId: prRecord.taskId,
        prId: prRecord._id,
        eventType: "review_submitted",
        actorLogin: review.user?.login ?? "unknown",
        summary: `Review ${reviewState === "approved" ? "approved" : reviewState === "changes_requested" ? "requested changes" : "submitted"} on PR #${pr.number}`,
        metadata: { prNumber: pr.number, reviewState, reviewId: review.id },
        occurredAt: Date.now(),
      });
    }
  }

  console.log(`[webhook] pull_request_review.${action} — PR #${pr.number} review: ${reviewState}`);
}

// ---------------------------------------------------------------------------
// handleWorkflowRunEvent — update CI status on PRs from same branch (6D)
// ---------------------------------------------------------------------------

async function handleWorkflowRunEvent(
  ctx: any,
  action: string | null,
  payload: Record<string, any>,
  orgId: string,
): Promise<void> {
  if (action !== "completed" && action !== "in_progress") return;

  const workflowRun = payload.workflow_run;
  const repoFullName: string = payload.repository?.full_name ?? "";
  if (!workflowRun || !repoFullName) return;

  const branch: string = workflowRun.head_branch ?? "";
  if (!branch) return;

  // Map workflow conclusion to CI status
  let ciStatus: "none" | "passing" | "failing" | "pending" = "none";
  if (action === "in_progress") {
    ciStatus = "pending";
  } else if (workflowRun.conclusion === "success") {
    ciStatus = "passing";
  } else if (workflowRun.conclusion === "failure" || workflowRun.conclusion === "timed_out") {
    ciStatus = "failing";
  } else if (workflowRun.conclusion === "cancelled") {
    // Don't update for cancelled runs
    return;
  }

  await ctx.runMutation(internal.sourceControl.tasks.prTracking.updateCIStatus, {
    orgId,
    repoFullName,
    branch,
    ciStatus,
  });

  // Also route to deployment tracking for deploy-tagged workflows
  const repo = await ctx.runQuery(internal.sourceControl.webhooks.handler.getReposByFullName, {
    repoFullName,
  });
  if (repo.length > 0) {
    await ctx.runMutation(
      internal.sourceControl.deployments.deploymentTracking.processWorkflowRun,
      {
        repositoryId: repo[0]._id,
        programId: repo[0].programId,
        workflowName: workflowRun.name ?? "",
        workflowRunId: workflowRun.id,
        status: workflowRun.status ?? "",
        conclusion: workflowRun.conclusion ?? undefined,
        sha: workflowRun.head_sha ?? "",
        ref: branch,
        actor: workflowRun.actor?.login ?? undefined,
        startedAt: workflowRun.run_started_at
          ? new Date(workflowRun.run_started_at).getTime()
          : Date.now(),
        completedAt: workflowRun.updated_at
          ? new Date(workflowRun.updated_at).getTime()
          : undefined,
      },
    );
  }

  // Emit CI status activity events for open PRs on this branch
  if (repo.length > 0 && (ciStatus === "passing" || ciStatus === "failing")) {
    const openPRs = await ctx.runQuery(internal.sourceControl.tasks.prTracking.getPRsByRepoBranch, {
      repositoryId: repo[0]._id,
      sourceBranch: branch,
    });
    for (const pr of openPRs) {
      await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
        orgId,
        taskId: pr.taskId,
        prId: pr._id,
        eventType: "ci_status_changed",
        actorLogin: workflowRun.actor?.login ?? "github-actions",
        summary: `CI ${ciStatus} for PR #${pr.prNumber} (${workflowRun.name ?? "workflow"})`,
        metadata: { ciStatus, workflowName: workflowRun.name, branch },
        occurredAt: Date.now(),
      });
    }
  }

  console.log(`[webhook] workflow_run.${action} — ${workflowRun.name} on ${branch}: ${ciStatus}`);
}

// ---------------------------------------------------------------------------
// handleDeploymentEvent — route deployment/deployment_status to tracking (6K)
// ---------------------------------------------------------------------------

async function handleDeploymentEvent(
  ctx: any,
  eventType: string,
  action: string | null,
  payload: Record<string, any>,
  _orgId: string,
): Promise<void> {
  const repoFullName: string = payload.repository?.full_name ?? "";
  if (!repoFullName) return;

  const repo = await ctx.runQuery(internal.sourceControl.webhooks.handler.getReposByFullName, {
    repoFullName,
  });
  if (repo.length === 0) return;

  const repoRecord = repo[0];
  const deployment = payload.deployment;
  if (!deployment) return;

  // Map deployment_status to our status enum
  let status: "pending" | "in_progress" | "success" | "failure" | "error" | "inactive" = "pending";
  if (eventType === "deployment_status") {
    const ghState: string = payload.deployment_status?.state ?? "";
    switch (ghState) {
      case "success":
        status = "success";
        break;
      case "failure":
        status = "failure";
        break;
      case "error":
        status = "error";
        break;
      case "in_progress":
        status = "in_progress";
        break;
      case "inactive":
        status = "inactive";
        break;
      default:
        status = "pending";
    }
  } else {
    // deployment event (creation) — starts as pending
    status = "pending";
  }

  await ctx.runMutation(
    internal.sourceControl.deployments.deploymentTracking.processDeploymentEvent,
    {
      repositoryId: repoRecord._id,
      programId: repoRecord.programId,
      rawEnvironment: deployment.environment ?? "production",
      status,
      sha: deployment.sha ?? "",
      ref: deployment.ref ?? "",
      providerDeploymentId: deployment.id ?? undefined,
      deployedBy: deployment.creator?.login ?? undefined,
      deployedAt: deployment.created_at ? new Date(deployment.created_at).getTime() : Date.now(),
      completedAt:
        eventType === "deployment_status" && payload.deployment_status?.created_at
          ? new Date(payload.deployment_status.created_at).getTime()
          : undefined,
    },
  );

  console.log(
    `[webhook] ${eventType}.${action} — deployment #${deployment.id} on ${repoFullName}: ${status}`,
  );
}

// ---------------------------------------------------------------------------
// handlePushEvent — store commits from push payload (3a)
// ---------------------------------------------------------------------------

async function handlePushEvent(
  ctx: any,
  payload: Record<string, any>,
  orgId: string,
): Promise<void> {
  const repoFullName: string = payload.repository?.full_name ?? "";
  if (!repoFullName) return;

  const repo = await ctx.runQuery(internal.sourceControl.webhooks.handler.getReposByFullName, {
    repoFullName,
  });
  if (repo.length === 0) return;

  const repoRecord = repo[0];
  const commits: Array<Record<string, any>> = payload.commits ?? [];

  // Look up existing PRs for this branch BEFORE storing commits so we can link them
  const pushedBranch = (payload.ref ?? "").replace("refs/heads/", "");
  let branchPRId: string | undefined;
  if (pushedBranch && repoRecord) {
    const branchPRs = await ctx.runQuery(
      internal.sourceControl.tasks.prTracking.getPRsByRepoBranch,
      { repositoryId: repoRecord._id, sourceBranch: pushedBranch },
    );
    if (branchPRs.length > 0) {
      branchPRId = branchPRs[0]._id;
    }
  }

  for (const commit of commits) {
    // Count file changes from commit metadata
    const added = commit.added?.length ?? 0;
    const removed = commit.removed?.length ?? 0;
    const modified = commit.modified?.length ?? 0;

    await ctx.runMutation(internal.sourceControl.sync.initialSync.storeCommit, {
      orgId,
      repositoryId: repoRecord._id,
      sha: commit.id ?? "",
      prId: branchPRId as any,
      authorLogin: commit.author?.username ?? commit.author?.name ?? "unknown",
      message: (commit.message ?? "").slice(0, 500),
      filesChanged: added + removed + modified,
      additions: added, // GitHub push payload doesn't include LOC additions/deletions per commit
      deletions: removed,
      committedAt: commit.timestamp ? new Date(commit.timestamp).getTime() : Date.now(),
    });
  }

  console.log(`[webhook] push — ${commits.length} commits stored for ${repoFullName}`);

  // Emit commit_pushed activity events for pushes on branches with linked PRs
  if (pushedBranch && commits.length > 0 && repoRecord) {
    const linkedPRs = await ctx.runQuery(
      internal.sourceControl.tasks.prTracking.getPRsByRepoBranch,
      { repositoryId: repoRecord._id, sourceBranch: pushedBranch },
    );
    for (const pr of linkedPRs) {
      await ctx.runMutation(internal.sourceControl.tasks.activityEvents.insertActivityEvent, {
        orgId,
        taskId: pr.taskId,
        prId: pr._id,
        eventType: "commit_pushed",
        actorLogin: commits[0]?.author?.username ?? commits[0]?.author?.name ?? "unknown",
        summary: `${commits.length} commit${commits.length === 1 ? "" : "s"} pushed to ${pushedBranch}`,
        metadata: {
          commitCount: commits.length,
          branch: pushedBranch,
          latestSha: commits[commits.length - 1]?.id?.slice(0, 7),
        },
        occurredAt: Date.now(),
      });
    }
  }

  // Check if this push is to a sandbox agent branch and update the session
  const ref: string = payload.ref ?? "";
  const branchName = ref.replace("refs/heads/", "");

  if (branchName.startsWith("agent/") && commits.length > 0) {
    try {
      const session = await ctx.runQuery(internal.sandbox.sessions.getByWorktreeBranch, {
        worktreeBranch: branchName,
        repositoryId: repoRecord._id,
      });

      if (session && !session.commitSha) {
        const lastCommit = commits[commits.length - 1];
        const totalFilesChanged = commits.reduce((sum: number, c: Record<string, any>) => {
          return (
            sum + (c.added?.length ?? 0) + (c.removed?.length ?? 0) + (c.modified?.length ?? 0)
          );
        }, 0);

        await ctx.runMutation(internal.sandbox.sessions.updateFromWebhook, {
          sessionId: session._id,
          commitSha: lastCommit?.id,
          filesChanged: totalFilesChanged,
        });

        console.log(
          `[webhook] push — updated sandbox session for branch ${branchName} (commit: ${lastCommit?.id?.slice(0, 7)}, files: ${totalFilesChanged})`,
        );
      }
    } catch (err) {
      console.error(`[webhook] push — sandbox session update failed for ${branchName}:`, err);
    }
  }

  // Auto-draft PR on first push to a sandbox/agent branch
  const isSandboxBranch = branchName.startsWith("sandbox/") || branchName.startsWith("agent/");

  if (isSandboxBranch && commits.length > 0 && repoRecord) {
    const existingPRs = await ctx.runQuery(
      internal.sourceControl.tasks.prTracking.getPRsByRepoBranch,
      { repositoryId: repoRecord._id, sourceBranch: branchName },
    );

    if (existingPRs.length === 0) {
      // Look up taskId from the sandbox session (already queried above for agent/ branches)
      let taskId: string | null = null;
      try {
        const prSession = await ctx.runQuery(internal.sandbox.sessions.getByWorktreeBranch, {
          worktreeBranch: branchName,
          repositoryId: repoRecord._id,
        });
        if (prSession?.taskId) {
          taskId = prSession.taskId;
        }
      } catch {
        // Fall back to parsing from branch name for sandbox/task-<id> format
        const taskSlug = branchName.split("/").pop() ?? "";
        if (taskSlug.startsWith("task-")) {
          taskId = taskSlug.slice(5);
        }
      }

      if (taskId) {
        await ctx.scheduler.runAfter(
          0,
          internal.sourceControl.tasks.prActionsInternal.createDraftPR,
          { taskId: taskId as any },
        );
        console.log(
          `[webhook] push — first push to ${branchName}, createDraftPR scheduled for task ${taskId}`,
        );
      }
    } else {
      // Branch already has a PR — if it's a draft, trigger AI description update
      const draftPR = existingPRs.find((p: any) => p.isDraft && p.state === "open");
      if (draftPR) {
        if (draftPR.aiDescriptionEnabled !== false) {
          await ctx.scheduler.runAfter(
            0,
            internal.sourceControl.tasks.prActionsInternal.internalRegenerateDescription,
            { prId: draftPR._id },
          );
          console.log(
            `[webhook] push — description regeneration scheduled for draft PR ${draftPR._id} on ${branchName}`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// handleRepositoryEvent — rename/transfer detection (3b)
// ---------------------------------------------------------------------------

async function handleRepositoryEvent(
  ctx: any,
  action: string | null,
  payload: Record<string, any>,
): Promise<void> {
  const repoFullName: string = payload.repository?.full_name ?? "";

  if (action === "renamed") {
    // On rename, the payload contains the old name in changes.repository.name.from
    const oldName: string = payload.changes?.repository?.name?.from ?? "";
    const owner: string = payload.repository?.owner?.login ?? "";
    if (oldName && owner) {
      const oldFullName = `${owner}/${oldName}`;
      await ctx.runMutation(internal.sourceControl.webhooks.handler.updateRepoFullName, {
        oldFullName,
        newFullName: repoFullName,
      });
      console.log(`[webhook] repository.renamed — updated ${oldFullName} → ${repoFullName}`);
    }
  } else if (action === "transferred") {
    // On transfer, mark sync state as stale since the repo owner changed
    await ctx.runMutation(internal.sourceControl.webhooks.handler.markSyncStateStale, {
      repoFullName,
    });
    console.log(`[webhook] repository.transferred — marked ${repoFullName} sync state as stale`);
  } else {
    console.log(`[webhook] repository.${action} — ${repoFullName} (no handler)`);
  }
}

// ---------------------------------------------------------------------------
// Helper — build human-readable summary for PR activity events
// ---------------------------------------------------------------------------

function buildPREventSummary(eventType: string, prNumber: number, prTitle: string): string {
  const short = prTitle.length > 60 ? `${prTitle.slice(0, 60)}…` : prTitle;
  switch (eventType) {
    case "pr_created":
      return `PR #${prNumber} opened: ${short}`;
    case "pr_merged":
      return `PR #${prNumber} merged: ${short}`;
    case "pr_closed":
      return `PR #${prNumber} closed: ${short}`;
    case "pr_reopened":
      return `PR #${prNumber} reopened: ${short}`;
    case "pr_converted_to_draft":
      return `PR #${prNumber} converted to draft`;
    case "pr_ready_for_review":
      return `PR #${prNumber} ready for review`;
    default:
      return `PR #${prNumber} updated`;
  }
}
