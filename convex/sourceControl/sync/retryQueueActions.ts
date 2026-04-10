// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";

/**
 * Retry queue action — Node.js runtime for outbound GitHub API calls.
 *
 * Exponential backoff: delay = min(2^retryCount * 1000, 3600000) ms
 * Rate limit (429): use Retry-After header for delay instead of exponential.
 * Max 10 retries (~17 hours total coverage).
 */

const MAX_BACKOFF_MS = 3600000; // 1 hour

// ---------------------------------------------------------------------------
// processRetry — attempt to execute a queued operation
// ---------------------------------------------------------------------------

export const processRetry = internalAction({
  args: { retryId: v.id("sourceControlRetryQueue") },
  handler: async (ctx, args) => {
    const entry = await ctx.runQuery(internal.sourceControl.sync.retryQueue.getRetryById, {
      retryId: args.retryId,
    });
    if (!entry) return;

    // Skip already-resolved entries
    if (entry.status === "succeeded" || entry.status === "abandoned") {
      return;
    }

    // Mark as retrying
    await ctx.runMutation(internal.sourceControl.sync.retryQueue.updateRetryStatus, {
      retryId: args.retryId,
      status: "retrying",
    });

    try {
      // Dispatch to the appropriate operation handler
      await executeOperation(ctx, entry.operationType, entry.payload);

      // Mark as succeeded
      await ctx.runMutation(internal.sourceControl.sync.retryQueue.updateRetryStatus, {
        retryId: args.retryId,
        status: "succeeded",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const newRetryCount = entry.retryCount + 1;

      if (newRetryCount >= entry.maxRetries) {
        // Exhausted retries — abandon
        await ctx.runMutation(internal.sourceControl.sync.retryQueue.updateRetryStatus, {
          retryId: args.retryId,
          status: "abandoned",
          retryCount: newRetryCount,
          lastError: errorMessage,
        });
        console.error(
          `Retry queue: abandoned ${entry.operationType} after ${newRetryCount} retries: ${errorMessage}`,
        );
      } else {
        // Calculate delay — check for rate limit Retry-After
        let delayMs: number;
        if (isRateLimitError(error)) {
          delayMs = extractRetryAfter(error) ?? MAX_BACKOFF_MS;
        } else {
          delayMs = Math.min(2 ** newRetryCount * 1000, MAX_BACKOFF_MS);
        }

        const nextRetryAt = Date.now() + delayMs;
        await ctx.runMutation(internal.sourceControl.sync.retryQueue.updateRetryStatus, {
          retryId: args.retryId,
          status: "pending",
          retryCount: newRetryCount,
          nextRetryAt,
          lastError: errorMessage,
        });

        // Schedule next retry
        await ctx.scheduler.runAfter(
          delayMs,
          internal.sourceControl.sync.retryQueueActions.processRetry,
          { retryId: args.retryId },
        );
      }
    }
  },
});

// ---------------------------------------------------------------------------
// executeOperation — dispatch to the correct outbound operation
// ---------------------------------------------------------------------------

async function executeOperation(
  _ctx: any,
  operationType: string,
  _payload: unknown,
): Promise<void> {
  // Each operation type will be wired up by the responsible team:
  // - create_issue / update_issue / update_issue_body: Task #6 (task-issue sync)
  // - post_review: AI review team
  switch (operationType) {
    case "create_issue":
    case "update_issue":
    case "update_issue_body":
    case "post_review":
      throw new Error(`Operation handler for "${operationType}" not yet implemented`);
    default:
      throw new Error(`Unknown operation type: ${operationType}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("429") ||
      error.message.includes("rate limit") ||
      error.message.includes("Rate limit")
    );
  }
  return false;
}

function extractRetryAfter(error: unknown): number | null {
  if (error instanceof Error) {
    const match = error.message.match(/Retry-After:\s*(\d+)/);
    if (match) {
      return parseInt(match[1], 10) * 1000; // Convert seconds to ms
    }
  }
  return null;
}
