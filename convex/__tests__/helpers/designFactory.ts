/**
 * Shared factory helpers for Design Context Pipeline tests.
 * Seeds user, program, design assets, token sets, analyses, and interactions.
 */

export const ORG_ID = "org-design";
export const CLERK_USER_ID = "design-user-1";
export const OTHER_ORG_ID = "org-other";
export const OTHER_CLERK_USER_ID = "design-user-2";

/**
 * Seeds a user + program for the design org.
 */
export async function seedDesignOrg(t: any): Promise<{
  userId: any;
  programId: any;
  orgId: string;
}> {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: CLERK_USER_ID,
      email: "design@example.com",
      name: "Design User",
      orgIds: [ORG_ID],
      role: "admin",
    });
  });

  const programId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("programs", {
      orgId: ORG_ID,
      name: "Design Program",
      clientName: "Design Client",
      sourcePlatform: "magento",
      targetPlatform: "salesforce_b2b",
      phase: "discovery",
      status: "active",
    });
  });

  return { userId, programId, orgId: ORG_ID };
}

/**
 * Seeds a user in a different org (for cross-org access tests).
 */
export async function seedOtherOrg(t: any): Promise<{
  userId: any;
  orgId: string;
}> {
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      clerkId: OTHER_CLERK_USER_ID,
      email: "other@example.com",
      name: "Other User",
      orgIds: [OTHER_ORG_ID],
      role: "admin",
    });
  });

  return { userId, orgId: OTHER_ORG_ID };
}

/**
 * Seeds a design asset directly in the DB (bypassing mutation for speed).
 */
export async function seedDesignAsset(
  t: any,
  args: {
    orgId: string;
    programId: any;
    name: string;
    type: string;
    status?: string;
    content?: string;
  },
): Promise<any> {
  return t.run(async (ctx: any) => {
    return await ctx.db.insert("designAssets", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      type: args.type,
      version: 1,
      status: args.status ?? "analyzed",
      content: args.content,
    });
  });
}

/**
 * Seeds a design token set directly in the DB.
 */
export async function seedTokenSet(
  t: any,
  args: {
    orgId: string;
    programId: any;
    name: string;
    sourceAssetId?: any;
    colors?: Record<string, string>;
  },
): Promise<any> {
  return t.run(async (ctx: any) => {
    return await ctx.db.insert("designTokenSets", {
      orgId: args.orgId,
      programId: args.programId,
      name: args.name,
      version: 1,
      colors: args.colors ? JSON.stringify(args.colors) : undefined,
      sourceType: "manual",
      sourceAssetId: args.sourceAssetId,
    });
  });
}

/**
 * Seeds a design analysis directly in the DB.
 */
export async function seedAnalysis(
  t: any,
  args: {
    orgId: string;
    programId: any;
    designAssetId: any;
    colors?: Array<{ name: string; hex: string; usage: string }>;
    typography?: Array<{ role: string; fontFamily: string; fontSize: string; fontWeight: string }>;
    components?: Array<{ name: string; type: string; description: string }>;
  },
): Promise<any> {
  return t.run(async (ctx: any) => {
    return await ctx.db.insert("designAnalyses", {
      orgId: args.orgId,
      programId: args.programId,
      designAssetId: args.designAssetId,
      structuredSpec: "{}",
      markdownSummary: "# Analysis",
      extractedColors: args.colors ?? [
        { name: "primary", hex: "#3B82F6", usage: "Brand color" },
        { name: "background", hex: "#0D1117", usage: "Page background" },
      ],
      extractedTypography: args.typography ?? [
        { role: "heading1", fontFamily: "Inter", fontSize: "32px", fontWeight: "600" },
      ],
      extractedComponents: args.components ?? [
        { name: "Button", type: "button", description: "Primary action button" },
      ],
      model: "claude-opus-4-1-20250805",
      inputTokens: 1000,
      outputTokens: 500,
      analyzedAt: Date.now(),
    });
  });
}

/**
 * Seeds an interaction spec directly in the DB.
 */
export async function seedInteraction(
  t: any,
  args: {
    orgId: string;
    programId: any;
    designAssetId?: any;
    componentName: string;
    trigger: string;
    animationType: string;
  },
): Promise<any> {
  return t.run(async (ctx: any) => {
    return await ctx.db.insert("designInteractions", {
      orgId: args.orgId,
      programId: args.programId,
      designAssetId: args.designAssetId,
      componentName: args.componentName,
      trigger: args.trigger,
      animationType: args.animationType,
      description: `${args.trigger} → ${args.animationType} on ${args.componentName}`,
    });
  });
}
