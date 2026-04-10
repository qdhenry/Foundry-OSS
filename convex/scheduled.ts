import { internalQuery } from "./_generated/server";

/**
 * Get all active programs for scheduled processing.
 */
export const getAllActivePrograms = internalQuery({
  args: {},
  handler: async (ctx) => {
    const programs = await ctx.db.query("programs").collect();

    return programs
      .filter((p) => p.status === "active")
      .map((p) => ({ _id: p._id, orgId: p.orgId }));
  },
});
