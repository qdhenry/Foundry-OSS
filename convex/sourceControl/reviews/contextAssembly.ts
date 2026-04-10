// @ts-nocheck
import { ConvexError, v } from "convex/values";
import { internalQuery } from "../../_generated/server";

/**
 * Migration context assembly for AI code reviews.
 *
 * Gathers data from the DB via internal queries, then the pure
 * `formatMigrationContext` function builds prompt sections from that data.
 */

// ---------------------------------------------------------------------------
// Internal query: load all context data for a PR review
// ---------------------------------------------------------------------------

export const getReviewContextData = internalQuery({
  args: {
    prId: v.id("sourceControlPullRequests"),
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    if (!pr) throw new ConvexError("PR not found");

    const repo = await ctx.db.get(pr.repositoryId);
    if (!repo) throw new ConvexError("Repository not found");

    const program = await ctx.db.get(repo.programId);
    if (!program) throw new ConvexError("Program not found");

    // Task + requirement
    let task = null;
    let requirement = null;
    if (pr.taskId) {
      task = await ctx.db.get(pr.taskId);
      if (task?.requirementId) {
        requirement = await ctx.db.get(task.requirementId);
      }
    }

    // Related requirements in the same workstream
    let relatedRequirements: any[] = [];
    if (task?.workstreamId) {
      relatedRequirements = await ctx.db
        .query("requirements")
        .withIndex("by_workstream", (q) => q.eq("workstreamId", task?.workstreamId!))
        .collect();
      if (requirement) {
        relatedRequirements = relatedRequirements.filter((r) => r._id !== requirement?._id);
      }
      relatedRequirements = relatedRequirements.slice(0, 10);
    }

    // Code snippets from pattern library matching target platform
    const snippets = await ctx.db
      .query("codeSnippets")
      .withIndex("by_platform", (q) => q.eq("targetPlatform", program.targetPlatform))
      .take(5);

    // Workstream info
    let workstream = null;
    if (task?.workstreamId) {
      workstream = await ctx.db.get(task.workstreamId);
    }

    return {
      pr,
      repo,
      program,
      task,
      requirement,
      workstream,
      relatedRequirements,
      snippets,
    };
  },
});

// ---------------------------------------------------------------------------
// Internal query: store a review record
// ---------------------------------------------------------------------------

export const createReviewRecord = internalQuery({
  args: { prId: v.id("sourceControlPullRequests") },
  handler: async (ctx, args) => {
    const pr = await ctx.db.get(args.prId);
    return pr;
  },
});

// ---------------------------------------------------------------------------
// Pure function: format context data into prompt sections
// ---------------------------------------------------------------------------

export interface MigrationContext {
  requirementContext: string;
  platformPatterns: string;
  historicalPatterns: string;
  relatedRequirements: string;
  snippets: string;
  totalTokenEstimate: number;
}

export function formatMigrationContext(data: {
  program: any;
  task: any;
  requirement: any;
  workstream: any;
  relatedRequirements: any[];
  snippets: any[];
}): MigrationContext {
  const { program, task, requirement, workstream, relatedRequirements, snippets } = data;

  // 1. Requirement context
  let requirementContext = "";
  if (requirement) {
    requirementContext = [
      `<requirement>`,
      `  <ref_id>${requirement.refId}</ref_id>`,
      `  <title>${requirement.title}</title>`,
      `  <description>${requirement.description ?? "N/A"}</description>`,
      `  <fit_gap>${requirement.fitGap}</fit_gap>`,
      `  <priority>${requirement.priority}</priority>`,
      `  <status>${requirement.status}</status>`,
      `</requirement>`,
    ].join("\n");
  }
  if (task) {
    requirementContext += [
      `\n<task>`,
      `  <title>${task.title}</title>`,
      `  <description>${task.description ?? "N/A"}</description>`,
      `  <priority>${task.priority}</priority>`,
      `  <status>${task.status}</status>`,
      `</task>`,
    ].join("\n");
  }

  // 2. Target platform patterns
  const platformPatterns = buildPlatformPatterns(program.targetPlatform);

  // 3. Historical patterns from code snippet library
  let historicalPatterns = "";
  if (snippets.length > 0) {
    const snippetXml = snippets
      .map((s: any) =>
        [
          `<snippet>`,
          `  <title>${s.title}</title>`,
          `  <description>${s.description}</description>`,
          `  <success_rating>${s.successRating}</success_rating>`,
          `  <code>${s.code}</code>`,
          s.annotations ? `  <annotations>${s.annotations}</annotations>` : "",
          `</snippet>`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n");
    historicalPatterns = `<historical_patterns>\n${snippetXml}\n</historical_patterns>`;
  }

  // 4. Related requirements
  let relatedReqsStr = "";
  if (relatedRequirements.length > 0) {
    const reqXml = relatedRequirements
      .map(
        (r: any) =>
          `  <req ref="${r.refId}" fit_gap="${r.fitGap}" priority="${r.priority}">${r.title}</req>`,
      )
      .join("\n");
    relatedReqsStr = `<related_requirements>\n${reqXml}\n</related_requirements>`;
  }

  // 5. Migration corridor context
  const corridorStr = [
    `<migration_context>`,
    `  <source_platform>${program.sourcePlatform}</source_platform>`,
    `  <target_platform>${program.targetPlatform}</target_platform>`,
    `  <program>${program.name}</program>`,
    workstream ? `  <workstream>${workstream.name} (${workstream.shortCode})</workstream>` : "",
    `</migration_context>`,
  ]
    .filter(Boolean)
    .join("\n");

  // Combine for token estimate (rough: 4 chars per token)
  const allText = [
    requirementContext,
    platformPatterns,
    historicalPatterns,
    relatedReqsStr,
    corridorStr,
  ].join("\n");
  const totalTokenEstimate = Math.ceil(allText.length / 4);

  return {
    requirementContext: `${corridorStr}\n${requirementContext}`,
    platformPatterns,
    historicalPatterns,
    relatedRequirements: relatedReqsStr,
    snippets: historicalPatterns,
    totalTokenEstimate,
  };
}

// ---------------------------------------------------------------------------
// Platform-specific pattern guidance
// ---------------------------------------------------------------------------

function buildPlatformPatterns(targetPlatform: string): string {
  if (targetPlatform === "salesforce_b2b") {
    return `<platform_patterns platform="salesforce_b2b">
  <pattern name="Apex Governor Limits">
    Verify code respects Salesforce governor limits: max 100 SOQL queries per transaction,
    max 150 DML statements, max 6MB heap size. Bulk operations must use collections,
    not row-by-row processing. Check for SOQL inside loops.
  </pattern>
  <pattern name="B2B Commerce API Conventions">
    B2B Commerce uses ConnectApi for cart operations, custom metadata for store config,
    and Lightning Web Components for storefront. Verify API versioning is explicit.
    Check that buyer group and entitlement policy assignments are handled correctly.
  </pattern>
  <pattern name="Trigger Pattern">
    One trigger per object, delegating to handler classes. Use trigger frameworks
    (e.g., TriggerHandler base class) for consistent before/after routing.
    No business logic directly in trigger files.
  </pattern>
  <pattern name="Security Review">
    CRUD/FLS checks required before DML operations. Use WITH SECURITY_ENFORCED in SOQL
    or stripInaccessible(). No hardcoded IDs. Lightning Locker Service compatibility required.
  </pattern>
</platform_patterns>`;
  }

  if (targetPlatform === "bigcommerce_b2b") {
    return `<platform_patterns platform="bigcommerce_b2b">
  <pattern name="B2B Edition API">
    Use the BigCommerce B2B Edition API (Company, Company Address, Company User endpoints).
    All requests require X-Auth-Token header. Rate limits: 450 requests/30 seconds for
    standard plans. Use webhooks for real-time sync rather than polling.
  </pattern>
  <pattern name="Storefront Customization">
    Stencil themes use Handlebars templating. Custom widgets via Script Manager or
    custom template files. Page Builder widgets for merchant-configurable components.
    Verify mobile responsiveness for all custom components.
  </pattern>
  <pattern name="Checkout Customization">
    Checkout SDK for custom checkout steps. Payment processing via stored payment
    instrument APIs. Quote management through B2B Edition quote endpoints.
    Verify PCI compliance boundaries.
  </pattern>
  <pattern name="Data Migration">
    Use bulk import APIs for products/categories/customers. Respect rate limits.
    Map Magento attribute sets to BigCommerce custom fields. Handle variant limits
    (max 600 variants per product). Image migration via URL import.
  </pattern>
</platform_patterns>`;
  }

  return `<platform_patterns platform="generic">
  <pattern name="Migration Best Practices">
    Verify data integrity during migration. Implement rollback mechanisms.
    Test with production-scale data volumes. Monitor for performance regressions.
  </pattern>
</platform_patterns>`;
}
