import type { MutationCtx } from "../_generated/server";
import { getAuthUser } from "./access";

export async function logAuditEvent(
  ctx: MutationCtx,
  args: {
    orgId: string;
    programId: string;
    entityType: string;
    entityId: string;
    action: "create" | "update" | "delete" | "status_change";
    description: string;
    metadata?: Record<string, unknown>;
  },
) {
  const user = await getAuthUser(ctx);

  await ctx.db.insert("auditLog", {
    orgId: args.orgId,
    programId: args.programId as any,
    entityType: args.entityType,
    entityId: args.entityId,
    action: args.action,
    userId: user._id,
    userName: user.name,
    description: args.description,
    metadata: args.metadata,
    timestamp: Date.now(),
  });
}
