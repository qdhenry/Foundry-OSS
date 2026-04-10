/**
 * Shared test factories for Convex backend tests.
 * Eliminates the duplicated `setupBaseData` pattern across 16+ test files.
 */

export interface SeedOrgOptions {
  orgId?: string;
  clerkId?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface SeedOrgResult {
  userId: string;
  orgId: string;
}

/**
 * Creates a user belonging to the given org.
 */
export async function seedOrg(t: any, opts: SeedOrgOptions = {}): Promise<SeedOrgResult> {
  const orgId = opts.orgId ?? "org-1";
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: opts.clerkId ?? "test-user-1",
      email: opts.email ?? "user1@example.com",
      name: opts.name ?? "User One",
      orgIds: [orgId],
      role: opts.role ?? "admin",
    });
  });
  return { userId, orgId };
}

/**
 * Creates a second user in a different org for cross-org isolation tests.
 */
export async function seedCrossOrgUser(t: any, opts: SeedOrgOptions = {}): Promise<SeedOrgResult> {
  const orgId = opts.orgId ?? "org-2";
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: opts.clerkId ?? "test-user-2",
      email: opts.email ?? "user2@example.com",
      name: opts.name ?? "User Two",
      orgIds: [orgId],
      role: opts.role ?? "admin",
    });
  });
  return { userId, orgId };
}

export interface SeedProgramOptions {
  orgId?: string;
  name?: string;
  engagementType?: string;
  phase?: string;
  status?: string;
  sourcePlatform?: string;
  targetPlatform?: string;
}

export interface SeedProgramResult {
  programId: string;
  workstreamId: string;
}

/**
 * Creates a program with one workstream.
 */
export async function seedProgram(
  t: any,
  opts: SeedProgramOptions = {},
): Promise<SeedProgramResult> {
  const orgId = opts.orgId ?? "org-1";

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId,
      name: opts.name ?? "Test Program",
      clientName: "Test Client",
      sourcePlatform: opts.sourcePlatform ?? "magento",
      targetPlatform: opts.targetPlatform ?? "salesforce_b2b",
      phase: opts.phase ?? "build",
      status: opts.status ?? "active",
      engagementType: opts.engagementType ?? "migration",
    });
  });

  const workstreamId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("workstreams", {
      orgId,
      programId,
      name: "Backend Workstream",
      shortCode: "BE",
      status: "on_track",
      sortOrder: 1,
    });
  });

  return { programId, workstreamId };
}

export interface SeedFullStackResult {
  userId: string;
  otherUserId: string;
  programId: string;
  workstreamId: string;
  sprintId: string;
  requirementId: string;
  orgId: string;
}

/**
 * Creates a full test data stack: two users (separate orgs), a program,
 * workstream, sprint, and requirement. Matches the pattern used by
 * tasks.test.ts, risks.test.ts, etc.
 */
export async function seedFullStack(t: any): Promise<SeedFullStackResult> {
  const { userId } = await seedOrg(t);
  const { userId: otherUserId } = await seedCrossOrgUser(t);
  const { programId, workstreamId } = await seedProgram(t);

  const sprintId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("sprints", {
      orgId: "org-1",
      programId,
      workstreamId,
      name: "Sprint 1",
      number: 1,
      status: "active",
    });
  });

  const requirementId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("requirements", {
      orgId: "org-1",
      programId,
      workstreamId,
      refId: "REQ-001",
      title: "Test Requirement",
      description: "A test requirement",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "approved",
    });
  });

  return {
    userId,
    otherUserId,
    programId,
    workstreamId,
    sprintId,
    requirementId,
    orgId: "org-1",
  };
}

/**
 * Convenience: sets up both users and returns identity helpers.
 */
export async function setupTestEnv(t: any) {
  const data = await seedFullStack(t);
  const asUser = t.withIdentity({ subject: "test-user-1" });
  const asOtherUser = t.withIdentity({ subject: "test-user-2" });
  return { ...data, asUser, asOtherUser };
}
