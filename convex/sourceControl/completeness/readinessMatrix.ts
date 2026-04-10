// @ts-nocheck
import { v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import { query } from "../../_generated/server";
import { assertOrgAccess } from "../../model/access";
import { computeScoreForRequirement } from "./implementationScore";

/**
 * 2D Readiness Matrix computation.
 *
 * Plots requirements on Scope Completeness (Y) vs Implementation
 * Completeness (X). Each requirement gets a quadrant label and color.
 *
 * DANGER and ROGUE trigger automatic warnings in sprint gate evaluations.
 */

// ---------------------------------------------------------------------------
// Quadrant definitions
// ---------------------------------------------------------------------------

export type ReadinessQuadrant =
  | "READY"
  | "IN_PROGRESS"
  | "SPECIFIED"
  | "DEFINED"
  | "RISKY"
  | "REVIEW"
  | "BACKLOG"
  | "DANGER"
  | "ROGUE";

interface QuadrantDef {
  label: ReadinessQuadrant;
  color: string;
  description: string;
}

const QUADRANTS: Record<ReadinessQuadrant, QuadrantDef> = {
  READY: { label: "READY", color: "green", description: "Well-specified and well-implemented" },
  IN_PROGRESS: { label: "IN_PROGRESS", color: "blue", description: "Well-specified, building" },
  SPECIFIED: {
    label: "SPECIFIED",
    color: "yellow",
    description: "Well-defined, needs development",
  },
  DEFINED: { label: "DEFINED", color: "gray", description: "Needs more spec and code" },
  RISKY: { label: "RISKY", color: "orange", description: "Building on shaky spec" },
  REVIEW: { label: "REVIEW", color: "amber", description: "Code done, spec weak" },
  BACKLOG: { label: "BACKLOG", color: "gray", description: "Not ready" },
  DANGER: { label: "DANGER", color: "red", description: "Coding without clear spec" },
  ROGUE: { label: "ROGUE", color: "red", description: "Built without any spec" },
};

// ---------------------------------------------------------------------------
// Quadrant thresholds
// ---------------------------------------------------------------------------

const HIGH = 67;
const MID = 34;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadinessMatrixEntry {
  requirementId: Id<"requirements">;
  refId: string;
  title: string;
  scopeCompleteness: number; // 0-100
  implementationCompleteness: number; // 0-100
  quadrant: ReadinessQuadrant;
  color: string;
  description: string;
  isWarning: boolean; // true for DANGER and ROGUE
}

export interface ReadinessMatrixResult {
  entries: ReadinessMatrixEntry[];
  summary: Record<ReadinessQuadrant, number>;
  warningCount: number;
  totalRequirements: number;
}

// ---------------------------------------------------------------------------
// computeReadinessMatrix — compute readiness matrix for a program
// ---------------------------------------------------------------------------

export const computeReadinessMatrix = query({
  args: {
    programId: v.id("programs"),
  },
  handler: async (ctx, args): Promise<ReadinessMatrixResult> => {
    // Load all requirements for this program
    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (requirements.length === 0) {
      return {
        entries: [],
        summary: emptySummary(),
        warningCount: 0,
        totalRequirements: 0,
      };
    }

    const entries: ReadinessMatrixEntry[] = [];
    const summary = emptySummary();
    let warningCount = 0;

    for (const req of requirements) {
      // Y-axis: Scope completeness
      const scopeCompleteness = computeScopeCompleteness(req);

      // X-axis: Implementation completeness
      const implementationCompleteness = await computeScoreForRequirement(
        ctx,
        req._id,
        args.programId,
      );

      // Map to quadrant
      const quadrant = classifyQuadrant(scopeCompleteness, implementationCompleteness);
      const quadrantDef = QUADRANTS[quadrant];
      const isWarning = quadrant === "DANGER" || quadrant === "ROGUE";

      if (isWarning) warningCount++;
      summary[quadrant]++;

      entries.push({
        requirementId: req._id,
        refId: req.refId,
        title: req.title,
        scopeCompleteness,
        implementationCompleteness,
        quadrant,
        color: quadrantDef.color,
        description: quadrantDef.description,
        isWarning,
      });
    }

    return {
      entries,
      summary,
      warningCount,
      totalRequirements: requirements.length,
    };
  },
});

// ---------------------------------------------------------------------------
// getForProgram — auth-checked readiness matrix (public)
// ---------------------------------------------------------------------------

export const getForProgram = query({
  args: { programId: v.id("programs") },
  handler: async (ctx, args): Promise<ReadinessMatrixResult> => {
    const program = await ctx.db.get(args.programId);
    if (!program) {
      return { entries: [], summary: emptySummary(), warningCount: 0, totalRequirements: 0 };
    }
    await assertOrgAccess(ctx, program.orgId);

    const requirements = await ctx.db
      .query("requirements")
      .withIndex("by_program", (q) => q.eq("programId", args.programId))
      .collect();

    if (requirements.length === 0) {
      return { entries: [], summary: emptySummary(), warningCount: 0, totalRequirements: 0 };
    }

    const entries: ReadinessMatrixEntry[] = [];
    const summary = emptySummary();
    let warningCount = 0;

    for (const req of requirements) {
      const scopeCompleteness = computeScopeCompleteness(req);
      const implementationCompleteness = await computeScoreForRequirement(
        ctx,
        req._id,
        args.programId,
      );
      const quadrant = classifyQuadrant(scopeCompleteness, implementationCompleteness);
      const quadrantDef = QUADRANTS[quadrant];
      const isWarning = quadrant === "DANGER" || quadrant === "ROGUE";
      if (isWarning) warningCount++;
      summary[quadrant]++;

      entries.push({
        requirementId: req._id,
        refId: req.refId,
        title: req.title,
        scopeCompleteness,
        implementationCompleteness,
        quadrant,
        color: quadrantDef.color,
        description: quadrantDef.description,
        isWarning,
      });
    }

    return { entries, summary, warningCount, totalRequirements: requirements.length };
  },
});

// ---------------------------------------------------------------------------
// Scope completeness heuristic
// ---------------------------------------------------------------------------

/**
 * Estimates scope completeness from requirement fields.
 * Phase 5 scope scoring is not yet available, so we derive a score
 * from requirement metadata: description, priority, fitGap, effortEstimate,
 * deliveryPhase, and status.
 */
function computeScopeCompleteness(req: Doc<"requirements">): number {
  let score = 0;
  const maxScore = 6;

  // Has a meaningful description
  if (req.description && req.description.length > 20) score++;

  // Priority is set (not deferred)
  if (req.priority !== "deferred") score++;

  // Fit/gap assessment is specific (not "not_feasible")
  if (req.fitGap && req.fitGap !== "not_feasible") score++;

  // Effort estimate is set
  if (req.effortEstimate) score++;

  // Delivery phase is set
  if (req.deliveryPhase) score++;

  // Status is beyond draft
  if (req.status !== "draft") score++;

  return Math.round((score / maxScore) * 100);
}

// ---------------------------------------------------------------------------
// Quadrant classification
// ---------------------------------------------------------------------------

function classifyQuadrant(scope: number, impl: number): ReadinessQuadrant {
  if (scope >= HIGH && impl >= HIGH) return "READY";
  if (scope >= HIGH && impl >= MID) return "IN_PROGRESS";
  if (scope >= HIGH && impl < MID) return "SPECIFIED";
  if (scope >= MID && impl < MID) return "DEFINED";
  if (scope >= MID && impl >= MID && impl < HIGH) return "RISKY";
  if (scope >= MID && impl >= HIGH) return "REVIEW";
  if (scope < MID && impl < MID) return "BACKLOG";
  if (scope < MID && impl >= MID && impl < HIGH) return "DANGER";
  if (scope < MID && impl >= HIGH) return "ROGUE";
  return "BACKLOG"; // fallback
}

// ---------------------------------------------------------------------------
// Empty summary
// ---------------------------------------------------------------------------

function emptySummary(): Record<ReadinessQuadrant, number> {
  return {
    READY: 0,
    IN_PROGRESS: 0,
    SPECIFIED: 0,
    DEFINED: 0,
    RISKY: 0,
    REVIEW: 0,
    BACKLOG: 0,
    DANGER: 0,
    ROGUE: 0,
  };
}
