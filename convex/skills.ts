import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";
import { SKILL_TEMPLATES } from "./skillTemplates";

const domainValidator = v.union(
  v.literal("architecture"),
  v.literal("backend"),
  v.literal("frontend"),
  v.literal("integration"),
  v.literal("deployment"),
  v.literal("testing"),
  v.literal("review"),
  v.literal("project"),
);

const targetPlatformValidator = v.union(
  v.literal("salesforce_b2b"),
  v.literal("bigcommerce_b2b"),
  v.literal("sitecore"),
  v.literal("wordpress"),
  v.literal("none"),
  v.literal("platform_agnostic"),
);

const statusValidator = v.union(v.literal("draft"), v.literal("active"), v.literal("deprecated"));

/**
 * List all skills for a program, optionally filtered by domain. Sorted by domain then name.
 * @param programId - The program to query
 * @param domain - Optional domain filter (e.g., "frontend", "backend")
 */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    domain: v.optional(domainValidator),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    let skills;
    if (args.domain !== undefined) {
      skills = await ctx.db
        .query("skills")
        .withIndex("by_domain", (q) => q.eq("programId", args.programId).eq("domain", args.domain!))
        .collect();
    } else {
      skills = await ctx.db
        .query("skills")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect();
    }

    skills.sort((a, b) => {
      const domainCmp = a.domain.localeCompare(b.domain);
      if (domainCmp !== 0) return domainCmp;
      return a.name.localeCompare(b.name);
    });

    return skills;
  },
});

/**
 * Retrieve a single skill by ID with resolved linked requirement references.
 * @param skillId - The skill to fetch
 */
export const get = query({
  args: { skillId: v.id("skills") },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");
    await assertOrgAccess(ctx, skill.orgId);

    const resolvedRequirements: {
      _id: string;
      refId: string;
      title: string;
    }[] = [];

    if (skill.linkedRequirements) {
      for (const reqId of skill.linkedRequirements) {
        const req = await ctx.db.get(reqId);
        if (req) {
          resolvedRequirements.push({
            _id: req._id,
            refId: req.refId,
            title: req.title,
          });
        }
      }
    }

    return {
      ...skill,
      resolvedRequirements,
    };
  },
});

/**
 * Create a new skill and its initial v1 version snapshot.
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param name - Skill display name
 * @param domain - Functional domain (e.g., "frontend", "backend")
 * @param targetPlatform - Target platform for the skill
 * @param content - Skill content/instructions
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    domain: domainValidator,
    targetPlatform: targetPlatformValidator,
    content: v.string(),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);

    const lineCount = args.content.split("\n").length;

    const skillId = await ctx.db.insert("skills", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      domain: args.domain,
      targetPlatform: args.targetPlatform,
      content: args.content,
      lineCount,
      currentVersion: "v1",
      status: args.status ?? "draft",
      linkedRequirements: [],
    });

    await ctx.db.insert("skillVersions", {
      orgId: args.orgId,
      skillId,
      version: "v1",
      content: args.content,
      lineCount,
      authorId: user._id,
      message: "Initial version",
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "skill",
      entityId: skillId as string,
      action: "create",
      description: `Created skill "${args.name}"`,
    });

    return skillId;
  },
});

/**
 * Update skill metadata (name, domain, platform, status). Does not change content.
 * @param skillId - The skill to update
 */
export const update = mutation({
  args: {
    skillId: v.id("skills"),
    name: v.optional(v.string()),
    domain: v.optional(domainValidator),
    targetPlatform: v.optional(targetPlatformValidator),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");
    await assertOrgAccess(ctx, skill.orgId);

    const { skillId: _, ...updates } = args;
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.skillId, patch);

      await logAuditEvent(ctx, {
        orgId: skill.orgId,
        programId: skill.programId as string,
        entityType: "skill",
        entityId: args.skillId as string,
        action: "update",
        description: `Updated skill "${skill.name}"`,
      });
    }
  },
});

/**
 * Update skill content and create a new immutable version snapshot.
 * @param skillId - The skill to update
 * @param content - New content body
 * @param message - Optional version commit message
 */
export const updateContent = mutation({
  args: {
    skillId: v.id("skills"),
    content: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");
    const user = await assertOrgAccess(ctx, skill.orgId);

    const lineCount = args.content.split("\n").length;

    const existingVersions = await ctx.db
      .query("skillVersions")
      .withIndex("by_skill", (q) => q.eq("skillId", args.skillId))
      .collect();

    const versionNumber = existingVersions.length + 1;
    const version = `v${versionNumber}`;

    await ctx.db.insert("skillVersions", {
      orgId: skill.orgId,
      skillId: args.skillId,
      version,
      content: args.content,
      lineCount,
      authorId: user._id,
      message: args.message,
    });

    await ctx.db.patch(args.skillId, {
      content: args.content,
      lineCount,
      currentVersion: version,
    });
  },
});

/**
 * Link a requirement to a skill. Both must belong to the same program.
 * @param skillId - The skill to link to
 * @param requirementId - The requirement to link
 */
export const linkRequirement = mutation({
  args: {
    skillId: v.id("skills"),
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");
    await assertOrgAccess(ctx, skill.orgId);

    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");

    if (skill.programId !== requirement.programId) {
      throw new ConvexError("Skill and requirement must be in the same program");
    }

    const current = skill.linkedRequirements ?? [];
    if (!current.includes(args.requirementId)) {
      await ctx.db.patch(args.skillId, {
        linkedRequirements: [...current, args.requirementId],
      });
    }
  },
});

/**
 * Remove a requirement link from a skill.
 * @param skillId - The skill to unlink from
 * @param requirementId - The requirement to unlink
 */
export const unlinkRequirement = mutation({
  args: {
    skillId: v.id("skills"),
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new ConvexError("Skill not found");
    await assertOrgAccess(ctx, skill.orgId);

    const current = skill.linkedRequirements ?? [];
    await ctx.db.patch(args.skillId, {
      linkedRequirements: current.filter((id) => id !== args.requirementId),
    });
  },
});

/** List all built-in skill templates available for forking. */
export const listTemplates = query({
  args: {},
  handler: async (_ctx, _args) => {
    return SKILL_TEMPLATES.map((t, index) => ({
      id: `template-${index}`,
      name: t.name,
      domain: t.domain,
      targetPlatform: t.targetPlatform,
      lineCount: t.content.split("\n").length,
      description: t.content.split("\n").slice(0, 3).join("\n"),
    }));
  },
});

// ---------------------------------------------------------------------------
// Internal query for Phase 3 AI features
// ---------------------------------------------------------------------------

export const getActiveByProgram = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    return skills.filter((s) => s.status === "active");
  },
});

export const getInternal = internalQuery({
  args: { skillId: v.id("skills") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.skillId);
  },
});

/**
 * Fork a built-in skill template into a program as a new draft skill.
 * @param orgId - Organization ID
 * @param programId - Target program
 * @param templateIndex - Index of the template to fork
 * @param name - Optional custom name (defaults to template name)
 */
export const forkTemplate = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    templateIndex: v.number(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await assertOrgAccess(ctx, args.orgId);

    const template = SKILL_TEMPLATES[args.templateIndex];
    if (!template) throw new ConvexError("Template not found");

    const lineCount = template.content.split("\n").length;
    const skillName = args.name ?? template.name;

    const skillId = await ctx.db.insert("skills", {
      orgId: args.orgId,
      programId: args.programId,
      name: skillName,
      domain: template.domain,
      targetPlatform: template.targetPlatform,
      content: template.content,
      lineCount,
      currentVersion: "v1",
      status: "draft",
      linkedRequirements: [],
    });

    await ctx.db.insert("skillVersions", {
      orgId: args.orgId,
      skillId,
      version: "v1",
      content: template.content,
      lineCount,
      authorId: user._id,
      message: `Forked from template: ${template.name}`,
    });

    return skillId;
  },
});
