import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";

/** List all team members for a program with resolved user details (name, email, avatar). */
export const listByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const enriched = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          ...member,
          user: user ? { name: user.name, email: user.email, avatarUrl: user.avatarUrl } : null,
        };
      }),
    );

    return enriched;
  },
});

/**
 * Add a user as a team member on a program. Prevents duplicate membership.
 * @param orgId - Organization ID
 * @param programId - Target program
 * @param userId - User to add
 * @param role - Team role (director, architect, developer, ba, qa, client)
 */
export const add = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    userId: v.id("users"),
    role: v.union(
      v.literal("director"),
      v.literal("architect"),
      v.literal("developer"),
      v.literal("ba"),
      v.literal("qa"),
      v.literal("client"),
    ),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const duplicate = existing.find((m) => m.userId === args.userId);
    if (duplicate) {
      throw new ConvexError("User is already a member of this program");
    }

    return await ctx.db.insert("teamMembers", {
      orgId: args.orgId,
      programId: args.programId,
      userId: args.userId,
      role: args.role,
      workstreamIds: args.workstreamIds,
    });
  },
});

/**
 * Update a team member's role or workstream assignments.
 * @param memberId - The team member record to update
 */
export const update = mutation({
  args: {
    memberId: v.id("teamMembers"),
    role: v.optional(
      v.union(
        v.literal("director"),
        v.literal("architect"),
        v.literal("developer"),
        v.literal("ba"),
        v.literal("qa"),
        v.literal("client"),
      ),
    ),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new ConvexError("Team member not found");

    const program = await ctx.db.get(member.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const patch: Record<string, unknown> = {};
    if (args.role !== undefined) patch.role = args.role;
    if (args.workstreamIds !== undefined) patch.workstreamIds = args.workstreamIds;

    await ctx.db.patch(args.memberId, patch);
  },
});

/** Remove a team member from a program. */
export const remove = mutation({
  args: { memberId: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new ConvexError("Team member not found");

    const program = await ctx.db.get(member.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    await ctx.db.delete(args.memberId);
  },
});

// ---------------------------------------------------------------------------
// Internal query for Phase 3 AI features
// ---------------------------------------------------------------------------

export const getByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("teamMembers")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    return Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          name: user?.name ?? "Unknown",
          expertise: user?.role ?? m.role,
        };
      }),
    );
  },
});
