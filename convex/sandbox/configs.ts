import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "../_generated/server";
import { assertOrgAccess } from "../model/access";

const hookBucketsValidator = v.object({
  preToolUse: v.array(v.any()),
  postToolUse: v.array(v.any()),
  stop: v.array(v.any()),
  notification: v.array(v.any()),
  error: v.array(v.any()),
  gitOperation: v.array(v.any()),
  fileChange: v.array(v.any()),
  testResult: v.array(v.any()),
});

const mcpServerValidator = v.object({
  name: v.string(),
  package: v.string(),
  config: v.any(),
  level: v.union(v.literal("global"), v.literal("project"), v.literal("task")),
});

const dotfileValidator = v.object({
  path: v.string(),
  content: v.string(),
});

const shellAliasValidator = v.object({
  name: v.string(),
  command: v.string(),
});

const devToolConfigValidator = v.object({
  tool: v.string(),
  config: v.string(),
});

const setupScriptValidator = v.object({
  name: v.string(),
  script: v.string(),
  runOrder: v.number(),
});

function defaultHooks() {
  return {
    preToolUse: [],
    postToolUse: [],
    stop: [],
    notification: [],
    error: [],
    gitOperation: [],
    fileChange: [],
    testResult: [],
  };
}

/** Get the sandbox configuration for an organization. */
export const getByOrg = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const db = ctx.db as any;
    return await db
      .query("sandboxConfigs")
      .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
      .first();
  },
});

export const getInternal = internalQuery({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    const db = ctx.db as any;
    return await db
      .query("sandboxConfigs")
      .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
      .first();
  },
});

/** Create or update the sandbox configuration for an organization. */
export const upsert = mutation({
  args: {
    orgId: v.string(),
    claudeSettings: v.optional(v.any()),
    hooks: v.optional(hookBucketsValidator),
    mcpServers: v.optional(v.array(mcpServerValidator)),
    dotfiles: v.optional(v.array(dotfileValidator)),
    shellAliases: v.optional(v.array(shellAliasValidator)),
    devToolConfigs: v.optional(v.array(devToolConfigValidator)),
    setupScripts: v.optional(v.array(setupScriptValidator)),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    const db = ctx.db as any;

    const existing = await db
      .query("sandboxConfigs")
      .withIndex("by_org", (q: any) => q.eq("orgId", args.orgId))
      .first();

    const next = {
      claudeSettings: args.claudeSettings ?? existing?.claudeSettings ?? {},
      hooks: args.hooks ?? existing?.hooks ?? defaultHooks(),
      mcpServers: args.mcpServers ?? existing?.mcpServers ?? [],
      dotfiles: args.dotfiles ?? existing?.dotfiles ?? [],
      shellAliases: args.shellAliases ?? existing?.shellAliases ?? [],
      devToolConfigs: args.devToolConfigs ?? existing?.devToolConfigs ?? [],
      setupScripts: args.setupScripts ?? existing?.setupScripts ?? [],
      updatedAt: Date.now(),
    };

    if (existing) {
      await db.patch(existing._id, next);
      return existing._id;
    }

    return await db.insert("sandboxConfigs", {
      orgId: args.orgId,
      ...next,
    });
  },
});

/** Delete a sandbox configuration. */
export const remove = mutation({
  args: { configId: v.id("sandboxConfigs") },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) throw new ConvexError("Sandbox config not found");
    await assertOrgAccess(ctx, config.orgId);

    await ctx.db.delete(args.configId);
    return args.configId;
  },
});
