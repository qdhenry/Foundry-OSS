import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

/**
 * Internal mutation invoked by the Convex HTTP endpoint that receives
 * per-invocation telemetry from the Cloudflare Tail Worker.
 *
 * Merges worker-level metrics (CPU time, outcomes, logs, exceptions) into
 * the executionAuditRecords.metadata.tailTelemetry field for the most
 * recent audit record associated with the given sandboxId.
 */
export const recordFromTail = internalMutation({
  args: {
    sandboxId: v.string(),
    route: v.string(),
    method: v.string(),
    outcome: v.string(),
    eventTimestamp: v.number(),
    cpuTimeMs: v.optional(v.number()),
    logs: v.optional(
      v.array(
        v.object({
          level: v.string(),
          message: v.string(),
          timestamp: v.number(),
        }),
      ),
    ),
    exceptions: v.optional(
      v.array(
        v.object({
          name: v.string(),
          message: v.string(),
          timestamp: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    // 1. Look up sandboxSession by sandboxId (using index)
    const session = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_sandboxId", (q) => q.eq("sandboxId", args.sandboxId))
      .first();
    if (!session) return; // Session not found — skip silently

    // 2. Find the most recent audit record for this session
    const auditRecord = await ctx.db
      .query("executionAuditRecords")
      .withIndex("by_session", (q) => q.eq("sandboxSessionId", session._id))
      .order("desc")
      .first();
    if (!auditRecord) return;

    // 3. Merge telemetry into metadata.tailTelemetry
    const existingMetadata = (auditRecord.metadata ?? {}) as Record<string, unknown>;
    const existing = (existingMetadata.tailTelemetry as {
      invocations: Array<Record<string, unknown>>;
      totalCpuTimeMs: number;
      totalInvocations: number;
      errorCount: number;
      exceptionCount: number;
    }) ?? {
      invocations: [],
      totalCpuTimeMs: 0,
      totalInvocations: 0,
      errorCount: 0,
      exceptionCount: 0,
    };

    existing.invocations.push({
      route: args.route,
      method: args.method,
      outcome: args.outcome,
      eventTimestamp: args.eventTimestamp,
      cpuTimeMs: args.cpuTimeMs,
      logCount: args.logs?.length ?? 0,
      exceptionCount: args.exceptions?.length ?? 0,
    });

    existing.totalInvocations += 1;
    existing.totalCpuTimeMs += args.cpuTimeMs ?? 0;
    if (args.outcome !== "ok") existing.errorCount += 1;
    if (args.exceptions?.length) existing.exceptionCount += args.exceptions.length;

    await ctx.db.patch(auditRecord._id, {
      metadata: {
        ...existingMetadata,
        tailTelemetry: existing,
      },
    });
  },
});
