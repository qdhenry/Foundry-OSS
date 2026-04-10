import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { parseCssVariables, parseJsonTokens } from "./tokenParser";

// ── Return type ───────────────────────────────────────────────────

export interface ResolvedDesignContext {
  resolvedTokens: Record<string, unknown>;
  resolvedComponents: Array<{
    name: string;
    type: string;
    description: string;
    codeMatch?: { filePath: string; componentName: string; confidence: number };
  }>;
  screenSpecs: string | null;
  interactionSpecs: Array<{
    componentName: string;
    trigger: string;
    animationType: string;
    duration?: string;
    easing?: string;
    description: string;
    codeSnippet?: string;
  }>;
  assetIds: Id<"designAssets">[];
  tokenSetId: Id<"designTokenSets"> | null;
  degraded: boolean;
}

// ── Main resolver ─────────────────────────────────────────────────

/**
 * Resolve the full design cascade for a task context.
 * Cascades program → workstream → requirement; most-specific level wins
 * when there are conflicts (first occurrence wins per component name).
 *
 * Only performs reads — safe to call from any QueryCtx.
 */
export async function resolveDesignCascade(
  ctx: QueryCtx,
  args: {
    orgId: string;
    programId: Id<"programs">;
    workstreamId?: Id<"workstreams">;
    requirementId?: Id<"requirements">;
  },
): Promise<ResolvedDesignContext> {
  const { orgId, programId, workstreamId, requirementId } = args;

  // ── 1. Program-level assets (no workstream, no requirement) ──────
  const allProgramAssets = await ctx.db
    .query("designAssets")
    .withIndex("by_program", (q) => q.eq("orgId", orgId).eq("programId", programId))
    .collect();

  const programLevelAssets = allProgramAssets.filter(
    (a) => a.workstreamId === undefined && a.requirementId === undefined,
  );

  // ── 2. Workstream-level assets ────────────────────────────────────
  const workstreamLevelAssets = workstreamId
    ? await ctx.db
        .query("designAssets")
        .withIndex("by_workstream", (q) =>
          q.eq("orgId", orgId).eq("programId", programId).eq("workstreamId", workstreamId),
        )
        .collect()
    : [];

  // ── 3. Requirement-level assets ───────────────────────────────────
  const requirementLevelAssets = requirementId
    ? await ctx.db
        .query("designAssets")
        .withIndex("by_requirement", (q) =>
          q.eq("orgId", orgId).eq("programId", programId).eq("requirementId", requirementId),
        )
        .collect()
    : [];

  // ── 4. Collect all asset IDs (deduped) ────────────────────────────
  const assetIdSet = new Set<Id<"designAssets">>();
  for (const asset of [
    ...programLevelAssets,
    ...workstreamLevelAssets,
    ...requirementLevelAssets,
  ]) {
    assetIdSet.add(asset._id);
  }
  const assetIds = Array.from(assetIdSet);

  // ── 5. Merge tokens from latest designTokenSets ───────────────────
  const tokenSets = await ctx.db
    .query("designTokenSets")
    .withIndex("by_program", (q) => q.eq("orgId", orgId).eq("programId", programId))
    .collect();

  // Pick highest version number
  let latestTokenSet = tokenSets.length > 0 ? tokenSets[0] : null;
  for (const ts of tokenSets) {
    if (latestTokenSet === null || ts.version > latestTokenSet.version) {
      latestTokenSet = ts;
    }
  }

  const resolvedTokens: Record<string, unknown> = {};
  let tokenSetId: Id<"designTokenSets"> | null = null;

  if (latestTokenSet !== null) {
    tokenSetId = latestTokenSet._id;

    // Parse each JSON field and merge into resolvedTokens
    const parseField = (raw: string | undefined, _key: string): Record<string, unknown> => {
      if (!raw) return {};
      try {
        return JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return {};
      }
    };

    if (latestTokenSet.colors) {
      resolvedTokens.colors = parseField(latestTokenSet.colors, "colors");
    }
    if (latestTokenSet.typography) {
      resolvedTokens.typography = parseField(latestTokenSet.typography, "typography");
    }
    if (latestTokenSet.spacing) {
      resolvedTokens.spacing = parseField(latestTokenSet.spacing, "spacing");
    }
    if (latestTokenSet.breakpoints) {
      resolvedTokens.breakpoints = parseField(latestTokenSet.breakpoints, "breakpoints");
    }
    if (latestTokenSet.shadows) {
      resolvedTokens.shadows = parseField(latestTokenSet.shadows, "shadows");
    }
    if (latestTokenSet.radii) {
      resolvedTokens.radii = parseField(latestTokenSet.radii, "radii");
    }

    // If jsonTokens is present, parse via tokenParser as a richer fallback
    if (latestTokenSet.jsonTokens) {
      const parsed = parseJsonTokens(latestTokenSet.jsonTokens);
      if (Object.keys(parsed.colors).length > 0 && !resolvedTokens.colors) {
        resolvedTokens.colors = parsed.colors;
      }
      if (Object.keys(parsed.typography).length > 0 && !resolvedTokens.typography) {
        resolvedTokens.typography = parsed.typography;
      }
      if (Object.keys(parsed.spacing).length > 0 && !resolvedTokens.spacing) {
        resolvedTokens.spacing = parsed.spacing;
      }
      if (Object.keys(parsed.breakpoints).length > 0 && !resolvedTokens.breakpoints) {
        resolvedTokens.breakpoints = parsed.breakpoints;
      }
      if (Object.keys(parsed.shadows).length > 0 && !resolvedTokens.shadows) {
        resolvedTokens.shadows = parsed.shadows;
      }
      if (Object.keys(parsed.radii).length > 0 && !resolvedTokens.radii) {
        resolvedTokens.radii = parsed.radii;
      }
    }

    // If cssVariables is present, parse and fill any missing keys
    if (latestTokenSet.cssVariables) {
      const parsed = parseCssVariables(latestTokenSet.cssVariables);
      if (Object.keys(parsed.colors).length > 0 && !resolvedTokens.colors) {
        resolvedTokens.colors = parsed.colors;
      }
      if (Object.keys(parsed.typography).length > 0 && !resolvedTokens.typography) {
        resolvedTokens.typography = parsed.typography;
      }
      if (Object.keys(parsed.spacing).length > 0 && !resolvedTokens.spacing) {
        resolvedTokens.spacing = parsed.spacing;
      }
      if (Object.keys(parsed.shadows).length > 0 && !resolvedTokens.shadows) {
        resolvedTokens.shadows = parsed.shadows;
      }
      if (Object.keys(parsed.radii).length > 0 && !resolvedTokens.radii) {
        resolvedTokens.radii = parsed.radii;
      }
    }
  }

  // ── 6. Collect component inventory from designAnalyses ────────────
  // Process in cascade order: program first, then workstream, then requirement.
  // First occurrence by component name wins (most-general first so specific
  // levels can override by being processed last — we reverse the dedup logic).
  // Actually: "most-specific wins" means requirement > workstream > program.
  // We process program first and requirement last, but dedup keeps LAST occurrence.
  // Use a Map to achieve last-write-wins (most specific).
  const componentMap = new Map<
    string,
    {
      name: string;
      type: string;
      description: string;
      codeMatch?: { filePath: string; componentName: string; confidence: number };
    }
  >();

  const levelsInCascadeOrder = [programLevelAssets, workstreamLevelAssets, requirementLevelAssets];

  for (const levelAssets of levelsInCascadeOrder) {
    for (const asset of levelAssets) {
      const analyses = await ctx.db
        .query("designAnalyses")
        .withIndex("by_asset", (q) => q.eq("designAssetId", asset._id))
        .collect();

      for (const analysis of analyses) {
        if (!analysis.extractedComponents) continue;
        for (const comp of analysis.extractedComponents) {
          componentMap.set(comp.name, {
            name: comp.name,
            type: comp.type,
            description: comp.description,
            ...(comp.codeMatch ? { codeMatch: comp.codeMatch } : {}),
          });
        }
      }
    }
  }

  const resolvedComponents = Array.from(componentMap.values());

  // ── 7. Screen specs — from requirement-level analyzed assets ──────
  let screenSpecs: string | null = null;

  if (requirementLevelAssets.length > 0) {
    // Collect all analyses for requirement-level assets, pick the latest by analyzedAt
    let latestAnalysis: { markdownSummary: string; analyzedAt: number } | null = null;

    for (const asset of requirementLevelAssets) {
      const analyses = await ctx.db
        .query("designAnalyses")
        .withIndex("by_asset", (q) => q.eq("designAssetId", asset._id))
        .collect();

      for (const analysis of analyses) {
        if (latestAnalysis === null || analysis.analyzedAt > latestAnalysis.analyzedAt) {
          latestAnalysis = {
            markdownSummary: analysis.markdownSummary,
            analyzedAt: analysis.analyzedAt,
          };
        }
      }
    }

    if (latestAnalysis !== null) {
      screenSpecs = latestAnalysis.markdownSummary;
    }
  }

  // ── 8. Collect interaction specs ──────────────────────────────────
  const interactions = await ctx.db
    .query("designInteractions")
    .withIndex("by_program", (q) => q.eq("orgId", orgId).eq("programId", programId))
    .collect();

  const interactionSpecs = interactions.map((i) => ({
    componentName: i.componentName,
    trigger: i.trigger,
    animationType: i.animationType,
    ...(i.duration !== undefined ? { duration: i.duration } : {}),
    ...(i.easing !== undefined ? { easing: i.easing } : {}),
    description: i.description,
    ...(i.codeSnippet !== undefined ? { codeSnippet: i.codeSnippet } : {}),
  }));

  // ── 9. Compute degraded flag ──────────────────────────────────────
  // Degraded = no token set AND no components resolved
  const degraded = tokenSetId === null && resolvedComponents.length === 0;

  return {
    resolvedTokens,
    resolvedComponents,
    screenSpecs,
    interactionSpecs,
    assetIds,
    tokenSetId,
    degraded,
  };
}
