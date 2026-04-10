/**
 * AI-related test factories for Convex backend tests.
 * Seeds skills, skill versions, agent executions, and task decompositions.
 */

export interface SeedSkillOptions {
  orgId?: string;
  programId: string;
  name?: string;
  type?: string;
}

export interface SeedSkillResult {
  skillId: string;
  skillVersionId: string;
}

/**
 * Creates a skill with an initial version.
 */
export async function seedSkillWithVersion(
  t: any,
  opts: SeedSkillOptions,
): Promise<SeedSkillResult> {
  const orgId = opts.orgId ?? "org-1";

  const skillId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("skills", {
      orgId,
      programId: opts.programId,
      name: opts.name ?? "Test Skill",
      type: opts.type ?? "analysis",
      status: "active",
    });
  });

  const skillVersionId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("skillVersions", {
      orgId,
      skillId,
      version: 1,
      content: "Test skill content for version 1",
      createdBy: "system",
    });
  });

  // Point skill at current version
  await t.run(async (ctx: any) => {
    await ctx.db.patch(skillId, { currentVersion: skillVersionId });
  });

  return { skillId, skillVersionId };
}

export interface SeedAgentExecutionOptions {
  orgId?: string;
  programId: string;
  taskId?: string;
  skillId?: string;
  status?: string;
}

/**
 * Creates an agent execution record.
 */
export async function seedAgentExecution(t: any, opts: SeedAgentExecutionOptions): Promise<string> {
  const orgId = opts.orgId ?? "org-1";

  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("agentExecutions", {
      orgId,
      programId: opts.programId,
      taskId: opts.taskId,
      skillId: opts.skillId,
      status: opts.status ?? "running",
      startedAt: Date.now(),
    });
  });
}

export interface SeedTaskDecompositionOptions {
  orgId?: string;
  programId: string;
  taskId: string;
}

/**
 * Creates a task decomposition record.
 */
export async function seedTaskDecomposition(
  t: any,
  opts: SeedTaskDecompositionOptions,
): Promise<string> {
  const orgId = opts.orgId ?? "org-1";

  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("taskDecompositions", {
      orgId,
      programId: opts.programId,
      taskId: opts.taskId,
      status: "completed",
      subtasks: [],
      createdAt: Date.now(),
    });
  });
}
