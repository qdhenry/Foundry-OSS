import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { assertOrgAccess } from "./model/access";
import { logAuditEvent } from "./model/audit";
import {
  calculateAggregateProgress,
  derivePipelineStage,
  type PipelineDerivationInput,
  type PipelineStage,
  pipelineSortComparator,
} from "./shared/pipelineStage";

const priorityValidator = v.union(
  v.literal("must_have"),
  v.literal("should_have"),
  v.literal("nice_to_have"),
  v.literal("deferred"),
);

const statusValidator = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("in_progress"),
  v.literal("complete"),
  v.literal("deferred"),
);

const fitGapValidator = v.union(
  v.literal("native"),
  v.literal("config"),
  v.literal("custom_dev"),
  v.literal("third_party"),
  v.literal("not_feasible"),
);

const effortValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("very_high"),
);

const deliveryPhaseValidator = v.union(
  v.literal("phase_1"),
  v.literal("phase_2"),
  v.literal("phase_3"),
);

/**
 * List requirements for a program with optional filters for batch, priority,
 * status, and workstream. Sorted by refId.
 * @param programId - The program to query
 */
export const listByProgram = query({
  args: {
    programId: v.id("programs"),
    batch: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    status: v.optional(statusValidator),
    workstreamId: v.optional(v.id("workstreams")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    let requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (args.batch !== undefined) {
      requirements = requirements.filter((r) => r.batch === args.batch);
    }
    if (args.priority !== undefined) {
      requirements = requirements.filter((r) => r.priority === args.priority);
    }
    if (args.status !== undefined) {
      requirements = requirements.filter((r) => r.status === args.status);
    }
    if (args.workstreamId !== undefined) {
      requirements = requirements.filter((r) => r.workstreamId === args.workstreamId);
    }

    requirements.sort((a, b) => a.refId.localeCompare(b.refId));

    return requirements;
  },
});

/**
 * Retrieve a single requirement by ID with resolved dependencies and evidence files.
 * @param requirementId - The requirement to fetch
 */
export const get = query({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    const resolvedDependencies: {
      _id: string;
      refId: string;
      title: string;
    }[] = [];
    if (requirement.dependencies) {
      for (const depId of requirement.dependencies) {
        const dep = await ctx.db.get(depId);
        if (dep) {
          resolvedDependencies.push({
            _id: dep._id,
            refId: dep.refId,
            title: dep.title,
          });
        }
      }
    }

    const evidenceRecords = await ctx.db
      .query("evidence")
      .withIndex("by_requirement", (q) => q.eq("requirementId", args.requirementId))
      .collect();

    const evidenceFiles = await Promise.all(
      evidenceRecords.map(async (e) => ({
        ...e,
        downloadUrl: await ctx.storage.getUrl(e.storageId),
      })),
    );

    return {
      ...requirement,
      resolvedDependencies,
      evidenceFiles,
    };
  },
});

/**
 * Create a new requirement with an auto-generated refId (REQ-001, REQ-002, etc.).
 * @param orgId - Organization ID
 * @param programId - Parent program
 * @param title - Requirement title
 * @param priority - MoSCoW priority level
 * @param fitGap - Fit/gap classification
 */
export const create = mutation({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    title: v.string(),
    description: v.optional(v.string()),
    batch: v.optional(v.string()),
    priority: priorityValidator,
    fitGap: fitGapValidator,
    effortEstimate: v.optional(effortValidator),
    deliveryPhase: v.optional(deliveryPhaseValidator),
    status: v.optional(statusValidator),
    workstreamId: v.optional(v.id("workstreams")),
  },
  handler: async (ctx, args) => {
    await assertOrgAccess(ctx, args.orgId);

    const existing = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const refId = `REQ-${String(existing.length + 1).padStart(3, "0")}`;

    const requirementId = await ctx.db.insert("requirements", {
      orgId: args.orgId,
      programId: args.programId,
      title: args.title,
      description: args.description,
      batch: args.batch,
      priority: args.priority,
      fitGap: args.fitGap,
      effortEstimate: args.effortEstimate,
      deliveryPhase: args.deliveryPhase,
      status: args.status ?? "draft",
      workstreamId: args.workstreamId,
      refId,
    });

    await logAuditEvent(ctx, {
      orgId: args.orgId,
      programId: args.programId as string,
      entityType: "requirement",
      entityId: requirementId as string,
      action: "create",
      description: `Created requirement "${args.title}" (${refId})`,
    });

    return requirementId;
  },
});

/**
 * Update requirement fields (title, description, priority, status, etc.).
 * @param requirementId - The requirement to update
 */
export const update = mutation({
  args: {
    requirementId: v.id("requirements"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    batch: v.optional(v.string()),
    priority: v.optional(priorityValidator),
    fitGap: v.optional(fitGapValidator),
    effortEstimate: v.optional(effortValidator),
    deliveryPhase: v.optional(deliveryPhaseValidator),
    status: v.optional(statusValidator),
    workstreamId: v.optional(v.id("workstreams")),
  },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    const { requirementId: _, ...updates } = args;
    const updateObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        updateObj[key] = value;
      }
    }

    if (Object.keys(updateObj).length > 0) {
      await ctx.db.patch(args.requirementId, updateObj);

      await logAuditEvent(ctx, {
        orgId: requirement.orgId,
        programId: requirement.programId as string,
        entityType: "requirement",
        entityId: args.requirementId as string,
        action: "update",
        description: `Updated requirement "${requirement.title}"`,
      });
    }
  },
});

/**
 * Change the status of a requirement (draft, approved, in_progress, complete, deferred).
 * @param requirementId - The requirement to update
 * @param status - New status value
 */
export const updateStatus = mutation({
  args: {
    requirementId: v.id("requirements"),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    await ctx.db.patch(args.requirementId, { status: args.status });

    await logAuditEvent(ctx, {
      orgId: requirement.orgId,
      programId: requirement.programId as string,
      entityType: "requirement",
      entityId: args.requirementId as string,
      action: "status_change",
      description: `Changed requirement status to "${args.status}"`,
    });
  },
});

export const linkDependency = mutation({
  args: {
    requirementId: v.id("requirements"),
    dependencyId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    const dependency = await ctx.db.get(args.dependencyId);
    if (!dependency) throw new Error("Dependency not found");

    if (requirement.programId !== dependency.programId) {
      throw new Error("Requirements must be in the same program");
    }

    const current = requirement.dependencies ?? [];
    if (!current.includes(args.dependencyId)) {
      await ctx.db.patch(args.requirementId, {
        dependencies: [...current, args.dependencyId],
      });
    }
  },
});

export const unlinkDependency = mutation({
  args: {
    requirementId: v.id("requirements"),
    dependencyId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new Error("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    const current = requirement.dependencies ?? [];
    await ctx.db.patch(args.requirementId, {
      dependencies: current.filter((id) => id !== args.dependencyId),
    });
  },
});

/** Count requirements grouped by status for a given program. */
export const countByStatus = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const counts = {
      draft: 0,
      approved: 0,
      in_progress: 0,
      complete: 0,
      deferred: 0,
      total: requirements.length,
    };

    for (const req of requirements) {
      counts[req.status]++;
    }

    return counts;
  },
});

/** Count requirements grouped by MoSCoW priority for a given program. */
export const countByPriority = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new Error("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const counts = {
      must_have: 0,
      should_have: 0,
      nice_to_have: 0,
      deferred: 0,
      total: requirements.length,
    };

    for (const req of requirements) {
      counts[req.priority]++;
    }

    return counts;
  },
});

// Internal query for duplicate awareness — returns just titles
export const listTitles = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return requirements.map((r) => r.title);
  },
});

// ---------------------------------------------------------------------------
// Bulk operations for Requirements page
// ---------------------------------------------------------------------------

/**
 * Paginated list of all requirements for a program with optional filters.
 * Used by the dedicated Requirements page.
 */
export const listAllByProgram = query({
  args: {
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    status: v.optional(statusValidator),
    unassigned: v.optional(v.boolean()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const pageSize = args.limit ?? 50;

    let requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Apply filters
    if (args.unassigned) {
      requirements = requirements.filter((r) => !r.workstreamId);
    } else if (args.workstreamId) {
      requirements = requirements.filter((r) => r.workstreamId === args.workstreamId);
    }
    if (args.status) {
      requirements = requirements.filter((r) => r.status === args.status);
    }

    requirements.sort((a, b) => a.refId.localeCompare(b.refId));

    // Paginate
    const cursorIndex = args.cursor ? parseInt(args.cursor, 10) : 0;
    const pageItems = requirements.slice(cursorIndex, cursorIndex + pageSize);
    const hasMore = cursorIndex + pageSize < requirements.length;

    // Enrich with workstream names and task counts
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const workstreamMap = new Map(workstreams.map((ws) => [ws._id, ws]));

    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const taskCountByReq = new Map<string, number>();
    for (const task of allTasks) {
      if (task.requirementId) {
        taskCountByReq.set(task.requirementId, (taskCountByReq.get(task.requirementId) ?? 0) + 1);
      }
    }

    const items = pageItems.map((req) => ({
      _id: req._id,
      refId: req.refId,
      title: req.title,
      description: req.description,
      priority: req.priority,
      status: req.status,
      fitGap: req.fitGap,
      effortEstimate: req.effortEstimate,
      deliveryPhase: req.deliveryPhase,
      workstreamId: req.workstreamId,
      workstreamName: req.workstreamId ? (workstreamMap.get(req.workstreamId)?.name ?? null) : null,
      taskCount: taskCountByReq.get(req._id) ?? 0,
    }));

    return {
      items,
      totalCount: requirements.length,
      hasMore,
      nextCursor: hasMore ? String(cursorIndex + pageSize) : undefined,
    };
  },
});

/**
 * Bulk assign multiple requirements to a workstream.
 */
export const bulkAssignWorkstream = mutation({
  args: {
    requirementIds: v.array(v.id("requirements")),
    workstreamId: v.id("workstreams"),
  },
  handler: async (ctx, args) => {
    if (args.requirementIds.length === 0) return { updated: 0 };
    if (args.requirementIds.length > 100) {
      throw new ConvexError("Cannot update more than 100 requirements at once");
    }

    const first = await ctx.db.get(args.requirementIds[0]);
    if (!first) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, first.orgId);

    const workstream = await ctx.db.get(args.workstreamId);
    if (!workstream) throw new ConvexError("Workstream not found");

    let updated = 0;
    for (const reqId of args.requirementIds) {
      const req = await ctx.db.get(reqId);
      if (req) {
        await ctx.db.patch(reqId, { workstreamId: args.workstreamId });
        updated++;
      }
    }

    await logAuditEvent(ctx, {
      orgId: first.orgId,
      programId: first.programId as string,
      entityType: "requirement",
      entityId: args.requirementIds[0] as string,
      action: "update",
      description: `Bulk assigned ${updated} requirements to workstream "${workstream.name}"`,
    });

    return { updated };
  },
});

/**
 * Bulk create tasks from requirements — one task per requirement.
 */
export const bulkCreateTasks = mutation({
  args: {
    requirementIds: v.array(v.id("requirements")),
  },
  handler: async (ctx, args) => {
    if (args.requirementIds.length === 0) return { created: 0 };
    if (args.requirementIds.length > 100) {
      throw new ConvexError("Cannot create more than 100 tasks at once");
    }

    const first = await ctx.db.get(args.requirementIds[0]);
    if (!first) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, first.orgId);

    let created = 0;
    for (const reqId of args.requirementIds) {
      const req = await ctx.db.get(reqId);
      if (req) {
        await ctx.db.insert("tasks", {
          orgId: req.orgId,
          programId: req.programId,
          workstreamId: req.workstreamId,
          requirementId: reqId,
          title: req.title,
          description: req.description,
          priority:
            req.priority === "must_have"
              ? "high"
              : req.priority === "should_have"
                ? "medium"
                : "low",
          status: "backlog",
        });
        created++;
      }
    }

    await logAuditEvent(ctx, {
      orgId: first.orgId,
      programId: first.programId as string,
      entityType: "task",
      entityId: args.requirementIds[0] as string,
      action: "create",
      description: `Bulk created ${created} tasks from requirements`,
    });

    return { created };
  },
});

/**
 * Count unassigned requirements for a program (used by Discovery "Next Step" card).
 */
export const countUnassigned = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const unassigned = requirements.filter((r) => !r.workstreamId);
    return { count: unassigned.length, total: requirements.length };
  },
});

// ---------------------------------------------------------------------------
// Internal queries for Phase 3 AI features
// ---------------------------------------------------------------------------

export const getById = internalQuery({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.requirementId);
  },
});

export const getWithContext = internalQuery({
  args: { requirementId: v.id("requirements") },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) return null;

    const program = await ctx.db.get(requirement.programId);

    // Scope to same workstream when available to reduce AI prompt token count
    let relatedRequirements;
    if (requirement.workstreamId) {
      relatedRequirements = await ctx.db
        .query("requirements")
        .withIndex("by_workstream", (q) => q.eq("workstreamId", requirement.workstreamId!))
        .collect();
    } else {
      relatedRequirements = await ctx.db
        .query("requirements")
        .withIndex("by_program", (q) => q.eq("programId", requirement.programId))
        .collect();
    }

    const relatedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", requirement.programId))
      .collect();
    const filteredTasks = relatedTasks.filter((t) => t.requirementId === args.requirementId);

    const activeSkills = await ctx.db
      .query("skills")
      .withIndex("by_program", (q) => q.eq("programId", requirement.programId))
      .collect();

    return {
      requirement,
      program,
      allRequirements: relatedRequirements
        .filter((r) => r._id !== args.requirementId)
        .map((r) => ({
          _id: r._id,
          refId: r.refId,
          title: r.title,
          priority: r.priority,
          fitGap: r.fitGap,
          status: r.status,
        })),
      relatedTasks: filteredTasks,
      activeSkills: activeSkills.filter((s) => s.status === "active"),
    };
  },
});

export const getByStatus = internalQuery({
  args: { programId: v.id("programs"), status: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    return all.filter((r) => r.status === args.status);
  },
});

export const listByProgramInternal = internalQuery({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Pipeline queries
// ---------------------------------------------------------------------------

const pipelineStageValidator = v.union(
  v.literal("discovery"),
  v.literal("requirement"),
  v.literal("sprint_planning"),
  v.literal("task_generation"),
  v.literal("subtask_generation"),
  v.literal("implementation"),
  v.literal("testing"),
  v.literal("review"),
);

/**
 * Returns requirements for a workstream with pre-computed pipeline stage,
 * joined context (finding, decomposition, tasks), sorted by stage then priority.
 */
export const listWithPipelineContext = query({
  args: {
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
    stage: v.optional(pipelineStageValidator),
    priority: v.optional(priorityValidator),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // Fetch requirements for this workstream
    let requirements = await ctx.db
      .query("requirements")
      .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId))
      .collect();

    // Filter to this program (workstream index doesn't include programId)
    requirements = requirements.filter((r) => r.programId === args.programId);

    if (args.priority !== undefined) {
      requirements = requirements.filter((r) => r.priority === args.priority);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      requirements = requirements.filter(
        (r) =>
          r.title.toLowerCase().includes(searchLower) ||
          r.refId.toLowerCase().includes(searchLower),
      );
    }

    // Batch-fetch all tasks for this program (to derive pipeline stages)
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Batch-fetch discovery findings for this program
    const allFindings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_program_type", (q) => q.eq("programId", args.programId))
      .collect();

    // Batch-fetch task decompositions for this program
    const allDecompositions = await ctx.db
      .query("taskDecompositions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Build lookup maps
    const tasksByReqId = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      if (task.requirementId) {
        const existing = tasksByReqId.get(task.requirementId) ?? [];
        existing.push(task);
        tasksByReqId.set(task.requirementId, existing);
      }
    }

    // Findings that were imported as requirements
    const findingByReqId = new Map<string, (typeof allFindings)[0]>();
    for (const finding of allFindings) {
      const importedAs = finding.importedAs as { type: string; id: string } | undefined;
      if (importedAs?.type === "requirement" && importedAs.id) {
        findingByReqId.set(importedAs.id, finding);
      }
    }

    const decompositionByReqId = new Map<string, (typeof allDecompositions)[0]>();
    for (const decomp of allDecompositions) {
      decompositionByReqId.set(decomp.requirementId, decomp);
    }

    // Fetch sprints for sprint name resolution
    const allSprints = await ctx.db
      .query("sprints")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const sprintMap = new Map(allSprints.map((s) => [s._id, s]));

    // Derive pipeline stage for each requirement
    const enriched = requirements.map((req) => {
      const tasks = tasksByReqId.get(req._id) ?? [];
      const finding = findingByReqId.get(req._id);
      const decomposition = decompositionByReqId.get(req._id);

      // Check if requirement has a sprint (via tasks or direct)
      const _hasSprintId = tasks.some((t) => t.sprintId) || false;
      const sprintId = tasks.find((t) => t.sprintId)?.sprintId;
      const sprint = sprintId ? sprintMap.get(sprintId) : undefined;

      const input: PipelineDerivationInput = {
        requirement: {
          status: req.status,
          workstreamId: req.workstreamId ?? null,
          sprintId: sprintId ?? null,
        },
        finding: finding ? { status: finding.status } : null,
        decomposition: decomposition ? { status: decomposition.status } : null,
        tasks: tasks.map((t) => ({
          status: t.status,
          hasSubtasks: t.hasSubtasks,
          subtaskGenerationStatus: t.subtaskGenerationStatus,
        })),
      };

      const pipelineStage = derivePipelineStage(input);

      return {
        _id: req._id,
        _creationTime: req._creationTime,
        refId: req.refId,
        title: req.title,
        description: req.description,
        priority: req.priority,
        fitGap: req.fitGap,
        effortEstimate: req.effortEstimate,
        status: req.status,
        workstreamId: req.workstreamId,
        pipelineStage,
        sprintName: sprint?.name,
        taskCount: tasks.length,
        tasksCompleted: tasks.filter((t) => t.status === "done").length,
        hasDecomposition: !!decomposition,
        hasFinding: !!finding,
      };
    });

    // Apply stage filter after derivation
    let result = enriched;
    if (args.stage !== undefined) {
      result = result.filter((r) => r.pipelineStage === args.stage);
    }

    // Sort: stage first, then priority
    result.sort((a, b) =>
      pipelineSortComparator(
        { pipelineStage: a.pipelineStage, priority: a.priority },
        { pipelineStage: b.pipelineStage, priority: b.priority },
      ),
    );

    return result;
  },
});

/**
 * Returns stage counts per workstream for the pipeline summary bar and widget,
 * plus effort-weighted progress percentages.
 */
export const pipelineStageCounts = query({
  args: {
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    // Fetch requirements
    let requirements;
    if (args.workstreamId) {
      requirements = await ctx.db
        .query("requirements")
        .withIndex("by_workstream", (q) => q.eq("workstreamId", args.workstreamId!))
        .collect();
      requirements = requirements.filter((r) => r.programId === args.programId);
    } else {
      requirements = await ctx.db
        .query("requirements")
        .withIndex("by_program", (q) => q.eq("programId", args.programId))
        .collect();
    }

    // Batch-fetch related data
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const allFindings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_program_type", (q) => q.eq("programId", args.programId))
      .collect();

    const allDecompositions = await ctx.db
      .query("taskDecompositions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Build lookup maps
    const tasksByReqId = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      if (task.requirementId) {
        const existing = tasksByReqId.get(task.requirementId) ?? [];
        existing.push(task);
        tasksByReqId.set(task.requirementId, existing);
      }
    }

    const findingByReqId = new Map<string, (typeof allFindings)[0]>();
    for (const finding of allFindings) {
      const importedAs = finding.importedAs as { type: string; id: string } | undefined;
      if (importedAs?.type === "requirement" && importedAs.id) {
        findingByReqId.set(importedAs.id, finding);
      }
    }

    const decompositionByReqId = new Map<string, (typeof allDecompositions)[0]>();
    for (const decomp of allDecompositions) {
      decompositionByReqId.set(decomp.requirementId, decomp);
    }

    // Count stages
    const counts: Record<PipelineStage, number> = {
      discovery: 0,
      requirement: 0,
      sprint_planning: 0,
      task_generation: 0,
      subtask_generation: 0,
      implementation: 0,
      testing: 0,
      review: 0,
    };

    for (const req of requirements) {
      const tasks = tasksByReqId.get(req._id) ?? [];
      const finding = findingByReqId.get(req._id);
      const decomposition = decompositionByReqId.get(req._id);
      const sprintId = tasks.find((t) => t.sprintId)?.sprintId;

      const input: PipelineDerivationInput = {
        requirement: {
          status: req.status,
          workstreamId: req.workstreamId ?? null,
          sprintId: sprintId ?? null,
        },
        finding: finding ? { status: finding.status } : null,
        decomposition: decomposition ? { status: decomposition.status } : null,
        tasks: tasks.map((t) => ({
          status: t.status,
          hasSubtasks: t.hasSubtasks,
          subtaskGenerationStatus: t.subtaskGenerationStatus,
        })),
      };

      const stage = derivePipelineStage(input);
      counts[stage]++;
    }

    const total = requirements.length;
    const progress = calculateAggregateProgress(counts);

    return {
      counts,
      total,
      progress,
    };
  },
});

/**
 * Paginated query for the Discovery Hub "Recently Imported" table.
 * Returns requirements that were imported from discovery findings,
 * scoped to the current program.
 */
export const recentlyImported = query({
  args: {
    programId: v.id("programs"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const pageSize = args.limit ?? 20;

    // Fetch all imported findings for this program
    const importedFindings = await ctx.db
      .query("discoveryFindings")
      .withIndex("by_program_status", (q) =>
        q.eq("programId", args.programId).eq("status", "imported"),
      )
      .collect();

    // Extract requirement IDs from imported findings
    const findingsByReqId = new Map<
      string,
      { documentId: string; importedAt: number; findingId: string }
    >();
    for (const finding of importedFindings) {
      const importedAs = finding.importedAs as { type: string; id: string } | undefined;
      if (importedAs?.type === "requirement" && importedAs.id) {
        findingsByReqId.set(importedAs.id, {
          documentId: finding.documentId,
          importedAt: finding.reviewedAt ?? finding._creationTime,
          findingId: finding._id,
        });
      }
    }

    if (findingsByReqId.size === 0) {
      return { items: [], hasMore: false, totalCount: 0 };
    }

    // Fetch all requirements for the program
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    // Filter to only imported requirements
    const importedReqs = requirements.filter((r) => findingsByReqId.has(r._id));

    // Sort by import time descending (most recent first)
    importedReqs.sort((a, b) => {
      const aTime = findingsByReqId.get(a._id)?.importedAt ?? 0;
      const bTime = findingsByReqId.get(b._id)?.importedAt ?? 0;
      return bTime - aTime;
    });

    // Batch-fetch related data for pipeline stage derivation
    const allTasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const allDecompositions = await ctx.db
      .query("taskDecompositions")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    const tasksByReqId = new Map<string, typeof allTasks>();
    for (const task of allTasks) {
      if (task.requirementId) {
        const existing = tasksByReqId.get(task.requirementId) ?? [];
        existing.push(task);
        tasksByReqId.set(task.requirementId, existing);
      }
    }

    const decompositionByReqId = new Map<string, (typeof allDecompositions)[0]>();
    for (const decomp of allDecompositions) {
      decompositionByReqId.set(decomp.requirementId, decomp);
    }

    // Fetch workstreams and documents for enrichment
    const workstreams = await ctx.db
      .query("workstreams")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const workstreamMap = new Map(workstreams.map((ws) => [ws._id, ws]));

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();
    const documentMap = new Map(documents.map((d) => [d._id, d]));

    // Simple pagination via cursor (offset-based using index)
    const cursorIndex = args.cursor ? parseInt(args.cursor, 10) : 0;
    const pageItems = importedReqs.slice(cursorIndex, cursorIndex + pageSize);
    const hasMore = cursorIndex + pageSize < importedReqs.length;

    // Enrich page items
    const items = pageItems.map((req) => {
      const findingInfo = findingsByReqId.get(req._id)!;
      const tasks = tasksByReqId.get(req._id) ?? [];
      const decomposition = decompositionByReqId.get(req._id);
      const sprintId = tasks.find((t) => t.sprintId)?.sprintId;

      const finding = importedFindings.find((f) => f._id === findingInfo.findingId);

      const input: PipelineDerivationInput = {
        requirement: {
          status: req.status,
          workstreamId: req.workstreamId ?? null,
          sprintId: sprintId ?? null,
        },
        finding: finding ? { status: finding.status } : null,
        decomposition: decomposition ? { status: decomposition.status } : null,
        tasks: tasks.map((t) => ({
          status: t.status,
          hasSubtasks: t.hasSubtasks,
          subtaskGenerationStatus: t.subtaskGenerationStatus,
        })),
      };

      const pipelineStage = derivePipelineStage(input);
      const ws = req.workstreamId ? workstreamMap.get(req.workstreamId) : undefined;
      const doc = documentMap.get(findingInfo.documentId as any);

      return {
        _id: req._id,
        refId: req.refId,
        title: req.title,
        priority: req.priority,
        status: req.status,
        pipelineStage,
        workstreamId: req.workstreamId,
        workstreamName: ws?.name ?? null,
        sourceDocumentName: doc?.fileName ?? "Unknown",
        importedAt: findingInfo.importedAt,
      };
    });

    return {
      items,
      hasMore,
      nextCursor: hasMore ? String(cursorIndex + pageSize) : undefined,
      totalCount: importedReqs.length,
    };
  },
});

/**
 * Cascade-delete helper: removes a single requirement and all related records.
 */
async function cascadeDeleteRequirement(ctx: any, requirementId: any) {
  // Delete evidence records
  const evidence = await ctx.db
    .query("evidence")
    .withIndex("by_requirement", (q: any) => q.eq("requirementId", requirementId))
    .collect();
  for (const e of evidence) {
    await ctx.db.delete(e._id);
  }

  // Delete refinement suggestions
  const suggestions = await ctx.db
    .query("refinementSuggestions")
    .withIndex("by_requirement", (q: any) => q.eq("requirementId", requirementId))
    .collect();
  for (const s of suggestions) {
    await ctx.db.delete(s._id);
  }

  // Delete task decompositions
  const decompositions = await ctx.db
    .query("taskDecompositions")
    .withIndex("by_requirement", (q: any) => q.eq("requirementId", requirementId))
    .collect();
  for (const d of decompositions) {
    await ctx.db.delete(d._id);
  }

  // Unlink from tasks
  const requirement = await ctx.db.get(requirementId);
  if (requirement) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_program", (q: any) => q.eq("programId", requirement.programId))
      .collect();
    for (const task of tasks) {
      if (task.requirementId === requirementId) {
        await ctx.db.patch(task._id, { requirementId: undefined });
      }
    }

    // Remove from skills.linkedRequirements arrays
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_program", (q: any) => q.eq("programId", requirement.programId))
      .collect();
    for (const skill of skills) {
      if (skill.linkedRequirements?.includes(requirementId)) {
        await ctx.db.patch(skill._id, {
          linkedRequirements: skill.linkedRequirements.filter((id: any) => id !== requirementId),
        });
      }
    }

    // Remove from integrations.requirementIds arrays
    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_program", (q: any) => q.eq("programId", requirement.programId))
      .collect();
    for (const integration of integrations) {
      if (integration.requirementIds?.includes(requirementId)) {
        await ctx.db.patch(integration._id, {
          requirementIds: integration.requirementIds.filter((id: any) => id !== requirementId),
        });
      }
    }

    // Remove from other requirements' dependencies arrays
    const allReqs = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q: any) => q.eq("programId", requirement.programId))
      .collect();
    for (const otherReq of allReqs) {
      if (otherReq.dependencies?.includes(requirementId)) {
        await ctx.db.patch(otherReq._id, {
          dependencies: otherReq.dependencies.filter((id: any) => id !== requirementId),
        });
      }
    }
  }

  // Delete the requirement itself
  await ctx.db.delete(requirementId);
}

/**
 * Delete a single requirement with full cascade cleanup.
 */
export const remove = mutation({
  args: {
    requirementId: v.id("requirements"),
  },
  handler: async (ctx, args) => {
    const requirement = await ctx.db.get(args.requirementId);
    if (!requirement) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, requirement.orgId);

    await cascadeDeleteRequirement(ctx, args.requirementId);

    await logAuditEvent(ctx, {
      orgId: requirement.orgId,
      programId: requirement.programId as string,
      entityType: "requirement",
      entityId: args.requirementId as string,
      action: "delete",
      description: `Deleted requirement "${requirement.title}" (${requirement.refId})`,
    });
  },
});

/**
 * Bulk delete multiple requirements with cascade cleanup.
 */
export const bulkRemove = mutation({
  args: {
    requirementIds: v.array(v.id("requirements")),
  },
  handler: async (ctx, args) => {
    if (args.requirementIds.length === 0) return { deleted: 0 };
    if (args.requirementIds.length > 100) {
      throw new ConvexError("Cannot delete more than 100 requirements at once");
    }

    const first = await ctx.db.get(args.requirementIds[0]);
    if (!first) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, first.orgId);

    let deleted = 0;
    for (const reqId of args.requirementIds) {
      const req = await ctx.db.get(reqId);
      if (req) {
        await cascadeDeleteRequirement(ctx, reqId);
        deleted++;
      }
    }

    await logAuditEvent(ctx, {
      orgId: first.orgId,
      programId: first.programId as string,
      entityType: "requirement",
      entityId: args.requirementIds[0] as string,
      action: "delete",
      description: `Bulk deleted ${deleted} requirements`,
    });

    return { deleted };
  },
});

/**
 * Bulk update status for multiple requirements.
 */
export const bulkUpdateStatus = mutation({
  args: {
    requirementIds: v.array(v.id("requirements")),
    status: statusValidator,
  },
  handler: async (ctx, args) => {
    if (args.requirementIds.length === 0) return { updated: 0 };
    if (args.requirementIds.length > 100) {
      throw new ConvexError("Cannot update more than 100 requirements at once");
    }

    const first = await ctx.db.get(args.requirementIds[0]);
    if (!first) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, first.orgId);

    let updated = 0;
    for (const reqId of args.requirementIds) {
      const req = await ctx.db.get(reqId);
      if (req) {
        await ctx.db.patch(reqId, { status: args.status });
        updated++;
      }
    }

    await logAuditEvent(ctx, {
      orgId: first.orgId,
      programId: first.programId as string,
      entityType: "requirement",
      entityId: args.requirementIds[0] as string,
      action: "status_change",
      description: `Bulk updated status to "${args.status}" for ${updated} requirements`,
    });

    return { updated };
  },
});

/**
 * Bulk update priority for multiple requirements.
 */
export const bulkUpdatePriority = mutation({
  args: {
    requirementIds: v.array(v.id("requirements")),
    priority: priorityValidator,
  },
  handler: async (ctx, args) => {
    if (args.requirementIds.length === 0) return { updated: 0 };
    if (args.requirementIds.length > 100) {
      throw new ConvexError("Cannot update more than 100 requirements at once");
    }

    const first = await ctx.db.get(args.requirementIds[0]);
    if (!first) throw new ConvexError("Requirement not found");
    await assertOrgAccess(ctx, first.orgId);

    let updated = 0;
    for (const reqId of args.requirementIds) {
      const req = await ctx.db.get(reqId);
      if (req) {
        await ctx.db.patch(reqId, { priority: args.priority });
        updated++;
      }
    }

    await logAuditEvent(ctx, {
      orgId: first.orgId,
      programId: first.programId as string,
      entityType: "requirement",
      entityId: args.requirementIds[0] as string,
      action: "update",
      description: `Bulk updated priority to "${args.priority}" for ${updated} requirements`,
    });

    return { updated };
  },
});

/**
 * Summary query for listing all requirements by program.
 * Returns minimal fields (_id, refId, title, workstreamId) for coverage metrics.
 */
export const listSummaryByProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args) => {
    const program = await ctx.db.get(args.programId);
    if (!program) throw new ConvexError("Program not found");
    await assertOrgAccess(ctx, program.orgId);

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    return requirements.map((r) => ({
      _id: r._id,
      refId: r.refId,
      title: r.title,
      workstreamId: r.workstreamId,
    }));
  },
});

// ---------------------------------------------------------------------------
// Internal mutation — update requirement status (used by analysis auto-apply)
// ---------------------------------------------------------------------------

export const updateStatusInternal = internalMutation({
  args: {
    requirementId: v.id("requirements"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requirementId, {
      status: args.status as any,
    });
  },
});
