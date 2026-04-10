import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertWithinPlanLimits } from "./billing/gates";
import { getAnthropicClient } from "./lib/aiClient";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";
import { generateUniqueSlug } from "./model/slugify";

export const ENGAGEMENT_TYPE_DEFAULTS: Record<
  string,
  { name: string; shortCode: string; sortOrder: number; description: string }[]
> = {
  greenfield: [
    {
      name: "Architecture & Foundation",
      shortCode: "WS-1",
      sortOrder: 1,
      description: "System architecture, tech stack setup, and foundational infrastructure",
    },
    {
      name: "Core Development",
      shortCode: "WS-2",
      sortOrder: 2,
      description: "Primary feature development and business logic implementation",
    },
    {
      name: "Data Layer & APIs",
      shortCode: "WS-3",
      sortOrder: 3,
      description: "Database design, API development, and data access patterns",
    },
    {
      name: "UI/UX Implementation",
      shortCode: "WS-4",
      sortOrder: 4,
      description: "Frontend development, design system, and user experience",
    },
    {
      name: "Testing & Quality",
      shortCode: "WS-5",
      sortOrder: 5,
      description: "Test strategy, automation, and quality assurance",
    },
    {
      name: "Deployment & Infrastructure",
      shortCode: "WS-6",
      sortOrder: 6,
      description: "CI/CD pipelines, cloud infrastructure, and DevOps",
    },
  ],
  migration: [
    {
      name: "Discovery & Assessment",
      shortCode: "WS-1",
      sortOrder: 1,
      description: "Current state analysis, gap assessment, and migration planning",
    },
    {
      name: "Architecture & Design",
      shortCode: "WS-2",
      sortOrder: 2,
      description: "Target architecture, design decisions, and migration strategy",
    },
    {
      name: "Core Implementation",
      shortCode: "WS-3",
      sortOrder: 3,
      description: "Primary migration development and feature parity",
    },
    {
      name: "Data Migration",
      shortCode: "WS-4",
      sortOrder: 4,
      description: "Data mapping, transformation, and migration execution",
    },
    {
      name: "Integration & APIs",
      shortCode: "WS-5",
      sortOrder: 5,
      description: "System integrations, API development, and third-party connections",
    },
    {
      name: "Testing & Launch",
      shortCode: "WS-6",
      sortOrder: 6,
      description: "Migration validation, UAT, and go-live planning",
    },
  ],
  integration: [
    {
      name: "System Analysis & Mapping",
      shortCode: "WS-1",
      sortOrder: 1,
      description: "Analyze existing systems and map integration points",
    },
    {
      name: "API Design & Development",
      shortCode: "WS-2",
      sortOrder: 2,
      description: "Design and implement APIs for system connectivity",
    },
    {
      name: "Data Transformation",
      shortCode: "WS-3",
      sortOrder: 3,
      description: "Data mapping, format conversion, and synchronization logic",
    },
    {
      name: "Error Handling & Monitoring",
      shortCode: "WS-4",
      sortOrder: 4,
      description: "Resilience patterns, error recovery, and observability",
    },
    {
      name: "Testing & Validation",
      shortCode: "WS-5",
      sortOrder: 5,
      description: "Integration testing, end-to-end validation, and performance testing",
    },
  ],
  ongoing_product_dev: [
    {
      name: "Product Backlog & Roadmap",
      shortCode: "WS-1",
      sortOrder: 1,
      description: "Feature prioritization, roadmap planning, and backlog refinement",
    },
    {
      name: "Feature Development",
      shortCode: "WS-2",
      sortOrder: 2,
      description: "New feature implementation and enhancements",
    },
    {
      name: "Technical Debt & Refactoring",
      shortCode: "WS-3",
      sortOrder: 3,
      description: "Code quality improvements, dependency updates, and architecture evolution",
    },
    {
      name: "Performance & Optimization",
      shortCode: "WS-4",
      sortOrder: 4,
      description: "Performance tuning, scalability improvements, and resource optimization",
    },
    {
      name: "Release & Operations",
      shortCode: "WS-5",
      sortOrder: 5,
      description: "Release management, monitoring, and operational excellence",
    },
  ],
};

/** List all programs accessible to the authenticated user within an organization. */
export const list = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);
    return await ctx.db
      .query("programs")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

/**
 * Retrieve a single program by ID, including computed stats (requirement counts,
 * workstream counts, risk counts, and agent execution counts).
 * @param programId - The program to fetch
 */
export const get = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const completedRequirements = requirements.filter((r) => r.status === "complete");

    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const risks = await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const agentExecutions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return {
      ...program,
      stats: {
        totalRequirements: requirements.length,
        completedRequirements: completedRequirements.length,
        completionPercent:
          requirements.length > 0
            ? Math.round((completedRequirements.length / requirements.length) * 100)
            : 0,
        workstreamCount: workstreams.length,
        riskCount: risks.length,
        agentExecutionCount: agentExecutions.length,
      },
    };
  },
});

/**
 * Create a new program within an organization, including initial workstreams.
 * Enforces plan/trial limits before insertion.
 * @param orgId - Organization ID
 * @param name - Program display name
 * @param clientName - Client or project name
 * @param engagementType - Type of delivery engagement
 * @param workstreams - Initial workstream definitions
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    name: v.string(),
    clientName: v.string(),
    sourcePlatform: v.optional(
      v.union(
        v.literal("magento"),
        v.literal("salesforce_b2b"),
        v.literal("bigcommerce_b2b"),
        v.literal("sitecore"),
        v.literal("wordpress"),
        v.literal("none"),
      ),
    ),
    targetPlatform: v.optional(
      v.union(
        v.literal("magento"),
        v.literal("salesforce_b2b"),
        v.literal("bigcommerce_b2b"),
        v.literal("sitecore"),
        v.literal("wordpress"),
        v.literal("none"),
      ),
    ),
    engagementType: v.union(
      v.literal("greenfield"),
      v.literal("migration"),
      v.literal("integration"),
      v.literal("ongoing_product_dev"),
    ),
    techStack: v.optional(
      v.array(
        v.object({
          category: v.string(),
          technologies: v.array(v.string()),
        }),
      ),
    ),
    workstreams: v.array(
      v.object({
        name: v.string(),
        shortCode: v.string(),
        sortOrder: v.number(),
        description: v.optional(v.string()),
      }),
    ),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    // Gate check — enforce plan/trial program limits
    await assertWithinPlanLimits(ctx, args.orgId, "program");

    const slug = await generateUniqueSlug(ctx, args.orgId, args.name);

    const programId = await ctx.db.insert("programs", {
      orgId: args.orgId,
      name: args.name,
      clientName: args.clientName,
      sourcePlatform: args.sourcePlatform ?? "none",
      targetPlatform: args.targetPlatform ?? "none",
      engagementType: args.engagementType,
      techStack: args.techStack,
      description: args.description,
      phase: "discovery",
      status: "active",
      setupStatus: "wizard" as const,
      jiraSyncMode: "auto_status_only" as const,
      jiraWorkflowConfigured: false,
      confluenceAutoIngest: false,
      slug,
    });

    for (const ws of args.workstreams) {
      await ctx.db.insert("workstreams", {
        orgId: args.orgId,
        programId,
        name: ws.name,
        shortCode: ws.shortCode,
        sortOrder: ws.sortOrder,
        status: "on_track",
        sprintCadence: 14,
        currentSprint: 1,
      });
    }

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: programId as string,
      entityType: "program",
      entityId: programId as string,
      action: "create",
      description: `Created program "${args.name}"`,
    });

    // Increment trial program counter if org is in trial
    const trial = await ctx.db
      .query("trialState")
      .withIndex("by_org", (q) => q.eq("orgId", args.orgId))
      .first();
    if (trial && !trial.convertedAt) {
      await ctx.db.patch(trial._id, {
        programsUsed: trial.programsUsed + 1,
      });
    }

    return programId;
  },
});

/**
 * AI-powered workstream suggestions based on engagement type and project context.
 * Falls back to built-in defaults on failure.
 * @param engagementType - The type of delivery engagement
 * @param description - Optional project description for context
 * @param techStack - Optional tech stack details for tailored suggestions
 */
export const suggestWorkstreams = action({
  args: {
    engagementType: v.union(
      v.literal("greenfield"),
      v.literal("migration"),
      v.literal("integration"),
      v.literal("ongoing_product_dev"),
    ),
    description: v.optional(v.string()),
    techStack: v.optional(
      v.array(
        v.object({
          category: v.string(),
          technologies: v.array(v.string()),
        }),
      ),
    ),
  },
  handler: async (
    _ctx,
    args,
  ): Promise<{ name: string; shortCode: string; sortOrder: number; description: string }[]> => {
    const techStackContext =
      args.techStack && args.techStack.length > 0
        ? `\nTech stack: ${args.techStack.map((t) => `${t.category}: ${t.technologies.join(", ")}`).join("; ")}`
        : "";
    const descriptionContext = args.description ? `\nProject description: ${args.description}` : "";

    const prompt = `You are a delivery planning specialist. Suggest 5-8 workstreams for a software delivery program.

Engagement type: ${args.engagementType.replace(/_/g, " ")}${descriptionContext}${techStackContext}

Return a JSON array of workstream objects. Each object must have:
- "name": descriptive workstream name (2-5 words)
- "shortCode": "WS-N" where N is the sequence number
- "sortOrder": integer sequence starting at 1
- "description": one sentence describing the workstream scope

Return ONLY the JSON array, no other text.`;

    try {
      const client = getAnthropicClient();
      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const parsed = JSON.parse(text.trim());
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name && parsed[0].shortCode) {
        return parsed;
      }
    } catch {
      // Fall back to defaults on any failure
    }

    return ENGAGEMENT_TYPE_DEFAULTS[args.engagementType] ?? ENGAGEMENT_TYPE_DEFAULTS.greenfield;
  },
});

/**
 * Update program metadata such as name, client, description, or dates.
 * @param programId - The program to update
 */
export const update = mutation({
  args: {
    programId: v.id("programs"),
    name: v.optional(v.string()),
    clientName: v.optional(v.string()),
    description: v.optional(v.string()),
    startDate: v.optional(v.number()),
    targetEndDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const { programId, ...updates } = args;
    const patch: Record<string, string | number> = {};
    if (updates.name !== undefined) {
      patch.name = updates.name;
      patch.slug = await generateUniqueSlug(ctx, program.orgId, updates.name);
    }
    if (updates.clientName !== undefined) patch.clientName = updates.clientName;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.startDate !== undefined) patch.startDate = updates.startDate;
    if (updates.targetEndDate !== undefined) patch.targetEndDate = updates.targetEndDate;

    await ctx.db.patch(programId, patch);

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: programId as string,
      entityType: "program",
      entityId: programId as string,
      action: "update",
      description: `Updated program settings`,
    });
  },
});

export const updateAtlassianSettings = mutation({
  args: {
    programId: v.id("programs"),
    jiraSyncMode: v.optional(
      v.union(v.literal("auto"), v.literal("auto_status_only"), v.literal("approval_required")),
    ),
    jiraWorkflowConfigured: v.optional(v.boolean()),
    confluenceAutoIngest: v.optional(v.boolean()),
    confluenceIngestFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const patch: Record<string, string | boolean> = {};
    if (args.jiraSyncMode !== undefined) {
      patch.jiraSyncMode = args.jiraSyncMode;
    }
    if (args.jiraWorkflowConfigured !== undefined) {
      patch.jiraWorkflowConfigured = args.jiraWorkflowConfigured;
    }
    if (args.confluenceAutoIngest !== undefined) {
      patch.confluenceAutoIngest = args.confluenceAutoIngest;
    }
    if (args.confluenceIngestFilter !== undefined) {
      patch.confluenceIngestFilter = args.confluenceIngestFilter;
    }

    if (Object.keys(patch).length === 0) return;

    await ctx.db.patch(args.programId, patch);

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "program",
      entityId: args.programId as string,
      action: "update",
      description: "Updated Atlassian integration settings",
      metadata: patch,
    });
  },
});

/**
 * Advance a program to a new lifecycle phase (discovery, build, test, deploy, complete).
 * @param programId - The program to update
 * @param phase - Target phase
 */
export const updatePhase = mutation({
  args: {
    programId: v.id("programs"),
    phase: v.union(
      v.literal("discovery"),
      v.literal("build"),
      v.literal("test"),
      v.literal("deploy"),
      v.literal("complete"),
    ),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    await ctx.db.patch(args.programId, { phase: args.phase });

    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "program",
      entityId: args.programId as string,
      action: "status_change",
      description: `Advanced phase to "${args.phase}"`,
    });
  },
});

export const updateSetupStatus = mutation({
  args: {
    programId: v.id("programs"),
    setupStatus: v.union(
      v.literal("wizard"),
      v.literal("analyzing"),
      v.literal("review"),
      v.literal("complete"),
    ),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);
    await ctx.db.patch(args.programId, { setupStatus: args.setupStatus });
  },
});

/**
 * Retrieve aggregate statistics for a program: requirement counts, workstream count,
 * risk count, and agent execution count.
 * @param programId - The program to query
 */
export const getStats = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const completedRequirements = requirements.filter((r) => r.status === "complete");

    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const risks = await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const agentExecutions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return {
      totalRequirements: requirements.length,
      completedRequirements: completedRequirements.length,
      completionPercent:
        requirements.length > 0
          ? Math.round((completedRequirements.length / requirements.length) * 100)
          : 0,
      workstreamCount: workstreams.length,
      riskCount: risks.length,
      agentExecutionCount: agentExecutions.length,
    };
  },
});

/**
 * Delete a program and cascade-delete all associated data (requirements, skills,
 * workstreams, risks, tasks, documents, and related records).
 * @param programId - The program to delete
 */
export const remove = mutation({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // Log audit event before cascade deletion
    await logAuditEvent(ctx, {
      orgId: program.orgId,
      programId: args.programId as string,
      entityType: "program",
      entityId: args.programId as string,
      action: "delete",
      description: `Deleted program "${program.name}" and all associated data`,
    });

    // 1. Evidence — query by requirement (no by_program index), also delete storage
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const req of requirements) {
      const evidence = await ctx.db
        .query("evidence")
        .withIndex("by_requirement", (q) => q.eq("requirementId", req._id))
        .collect();
      for (const ev of evidence) {
        await ctx.storage.delete(ev.storageId);
        await ctx.db.delete(ev._id);
      }
    }

    // 2. Skill Versions — query by skill (no by_program index)
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const skill of skills) {
      const versions = await ctx.db
        .query("skillVersions")
        .withIndex("by_skill", (q) => q.eq("skillId", skill._id))
        .collect();
      for (const version of versions) {
        await ctx.db.delete(version._id);
      }
    }

    // 3. Comments — query by_org and filter by programId in JS
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_org", (q) => q.eq("orgId", program.orgId))
      .collect();
    for (const comment of comments) {
      if (comment.programId === args.programId) {
        await ctx.db.delete(comment._id);
      }
    }

    // 4. Documents — also delete storage files
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const doc of documents) {
      if (doc.storageId) {
        await ctx.storage.delete(doc.storageId);
      }
      await ctx.db.delete(doc._id);
    }

    // 5. Tables with by_program index — delete all records
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of workstreams) {
      await ctx.db.delete(item._id);
    }

    // Requirements already fetched above
    for (const item of requirements) {
      await ctx.db.delete(item._id);
    }

    // Skills already fetched above
    for (const item of skills) {
      await ctx.db.delete(item._id);
    }

    const risks = await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of risks) {
      await ctx.db.delete(item._id);
    }

    const sprintGates = await ctx.db
      .query("sprintGates")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of sprintGates) {
      await ctx.db.delete(item._id);
    }

    const agentExecutions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of agentExecutions) {
      await ctx.db.delete(item._id);
    }

    const auditLogs = await ctx.db
      .query("auditLog")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of auditLogs) {
      await ctx.db.delete(item._id);
    }

    const sprints = await ctx.db
      .query("sprints")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of sprints) {
      await ctx.db.delete(item._id);
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of tasks) {
      await ctx.db.delete(item._id);
    }

    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of integrations) {
      await ctx.db.delete(item._id);
    }

    const playbooks = await ctx.db
      .query("playbooks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of playbooks) {
      await ctx.db.delete(item._id);
    }

    const playbookInstances = await ctx.db
      .query("playbookInstances")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of playbookInstances) {
      await ctx.db.delete(item._id);
    }

    const workstreamDependencies = await ctx.db
      .query("workstreamDependencies")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of workstreamDependencies) {
      await ctx.db.delete(item._id);
    }

    const teamMembers = await ctx.db
      .query("teamMembers")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of teamMembers) {
      await ctx.db.delete(item._id);
    }

    const atlassianConnections = await ctx.db
      .query("atlassianConnections")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of atlassianConnections) {
      await ctx.db.delete(item._id);
    }

    const jiraSyncRecords = await ctx.db
      .query("jiraSyncRecords")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of jiraSyncRecords) {
      await ctx.db.delete(item._id);
    }

    const confluencePageRecords = await ctx.db
      .query("confluencePageRecords")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of confluencePageRecords) {
      await ctx.db.delete(item._id);
    }

    const jiraSyncQueue = await ctx.db
      .query("jiraSyncQueue")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of jiraSyncQueue) {
      await ctx.db.delete(item._id);
    }

    const atlassianWebhookEvents = await ctx.db
      .query("atlassianWebhookEvents")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    for (const item of atlassianWebhookEvents) {
      await ctx.db.delete(item._id);
    }

    // Finally, delete the program itself
    await ctx.db.delete(args.programId);
  },
});

/**
 * Look up a program by its URL slug within an organization. Falls back to raw
 * Convex ID lookup for backwards compatibility with old URLs.
 * @param orgId - Organization ID
 * @param slug - URL-friendly program slug or raw Convex ID
 */
export const getBySlug = query({
  args: { orgId: v.string(), slug: v.string() },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    // Try slug-based lookup first
    let program = await ctx.db
      .query("programs")
      .withIndex("by_org_slug", (q) => q.eq("orgId", args.orgId).eq("slug", args.slug))
      .unique();

    // Fallback: try as a raw Convex ID (supports old URLs and notification links)
    if (!program) {
      try {
        const byId = await ctx.db.get(args.slug as Id<"programs">);
        if (byId && byId.orgId === args.orgId) {
          program = byId;
        }
      } catch {
        // Not a valid Convex ID — ignore
      }
    }

    if (!program) return null;

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", program._id))
      .collect();
    const completedRequirements = requirements.filter((r) => r.status === "complete");

    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", program._id))
      .collect();

    const risks = await ctx.db
      .query("risks")
      .withIndex("by_program", (q) => q.eq("programId", program._id))
      .collect();

    const agentExecutions = await ctx.db
      .query("agentExecutions")
      .withIndex("by_program", (q) => q.eq("programId", program._id))
      .collect();

    return {
      ...program,
      stats: {
        totalRequirements: requirements.length,
        completedRequirements: completedRequirements.length,
        completionPercent:
          requirements.length > 0
            ? Math.round((completedRequirements.length / requirements.length) * 100)
            : 0,
        workstreamCount: workstreams.length,
        riskCount: risks.length,
        agentExecutionCount: agentExecutions.length,
      },
    };
  },
});

/**
 * Retrieve lightweight counts used by the sidebar navigation: pending discoveries,
 * requirements, workstreams, sprints, tasks, skills, risks, gates, and design assets.
 * @param programId - The program to query
 */
export const getNavigationState = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const [
      findings,
      requirements,
      workstreams,
      sprints,
      tasks,
      skills,
      risks,
      gates,
      designAssets,
    ] = await Promise.all([
      ctx.db
        .query("discoveryFindings")
        .withIndex("by_program_status", (q) =>
          q.eq("programId", args.programId).eq("status", "pending"),
        )
        .collect(),
      ctx.db
        .query("requirements")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect(),
      ctx.db
        .query("workstreams")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect(),
      ctx.db
        .query("sprints")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect(),
      ctx.db
        .query("tasks")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect(),
      ctx.db
        .query("skills")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect(),
      ctx.db
        .query("risks")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect(),
      ctx.db
        .query("sprintGates")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect(),
      ctx.db
        .query("designAssets")
        .withIndex("by_program", (q) =>
          q.eq("orgId", program.orgId).eq("programId", args.programId),
        )
        .collect(),
    ]);

    return {
      discoveryPending: findings.length,
      requirementsTotal: requirements.length,
      requirementsUnassigned: requirements.filter((r) => !r.workstreamId).length,
      workstreamsCount: workstreams.length,
      sprintsActive: sprints.filter((s) => s.status === "active").length,
      sprintsPlanning: sprints.filter((s) => s.status === "planning").length,
      tasksTotal: tasks.length,
      tasksInProgress: tasks.filter((t) => t.status === "in_progress").length,
      skillsCount: skills.length,
      risksCount: risks.length,
      gatesCount: gates.length,
      designAssetsTotal: designAssets.length,
    };
  },
});

// One-time migration: backfill slugs for existing programs
export const backfillSlugs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const programs = await ctx.db.query("programs").collect();
    let updated = 0;
    for (const program of programs) {
      if (!program.slug) {
        const slug = await generateUniqueSlug(ctx, program.orgId, program.name);
        await ctx.db.patch(program._id, { slug });
        updated++;
      }
    }
    return { updated, total: programs.length };
  },
});

// Internal query for agent context — get program by ID without auth
export const getById = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.programId);
  },
});

// Internal query for provisioning — get program by ID without auth
export const getByIdInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.programId);
  },
});
