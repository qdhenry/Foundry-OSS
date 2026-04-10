import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function assertOrgAccess(ctx: QueryCtx | MutationCtx, orgId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) throw new ConvexError("Access denied");

  // Check stored orgIds first, then fall back to the Clerk JWT org claim.
  // The JWT org_id is authoritative when the webhook hasn't synced yet
  // (e.g., admin-assigned org memberships).
  const jwtOrgId = (identity as any).org_id as string | undefined;
  if (!user.orgIds.includes(orgId) && jwtOrgId !== orgId) {
    throw new ConvexError("Access denied");
  }

  return user;
}

export async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) throw new ConvexError("User not found");

  return user;
}

export async function getAuthUserOrNull(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}
