// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { callAI } from "../../lib/aiClient";
import { getProvider } from "../factory";

/**
 * Code pattern mining action — extract and anonymize code patterns from completed work.
 *
 * Pipeline:
 * 1. For each completed requirement, identify implementing PRs and files
 * 2. AI classifies implementation approach
 * 3. Compute complexity metrics (actual LOC, files, PRs vs estimated story points)
 * 4. Anonymization via AI
 * 5. Store with metadata: requirement category, target platform, success rating
 */

// ---------------------------------------------------------------------------
// minePatterns — extract and anonymize code patterns from completed work
// ---------------------------------------------------------------------------

export const minePatterns = internalAction({
  args: {
    programId: v.id("programs"),
    sprintId: v.optional(v.id("sprints")),
  },
  handler: async (ctx, args) => {
    // 1. Load the program and its repos
    const program = await ctx.runQuery(
      internal.sourceControl.patterns.patternMining.getProgramContext,
      { programId: args.programId },
    );
    if (!program) return;

    const repos = await ctx.runQuery(
      internal.sourceControl.patterns.patternMining.getReposForProgram,
      { programId: args.programId },
    );
    if (repos.length === 0) return;

    // 2. Get completed requirements (optionally scoped to a sprint)
    const completedReqs = await ctx.runQuery(
      internal.sourceControl.patterns.patternMining.getCompletedRequirements,
      { programId: args.programId, sprintId: args.sprintId },
    );
    if (completedReqs.length === 0) return;

    // 3. For each requirement, gather PRs and mine patterns
    let _totalPatternTokens = 0;
    let _patternsExtracted = 0;
    for (const req of completedReqs) {
      const prs = await ctx.runQuery(
        internal.sourceControl.patterns.patternMining.getMergedPRsForRequirement,
        { requirementId: req._id, programId: args.programId },
      );
      if (prs.length === 0) continue;

      // Compute complexity metrics
      const complexity = computeComplexityMetrics(prs);

      // Determine success rating based on merge velocity heuristic
      const successRating = computeSuccessRating(prs);

      // Get a diff sample for AI analysis (use the first repo with a matching PR)
      const firstPR = prs[0];
      const repo = repos.find((r: { _id: string }) => r._id === firstPR.repositoryId);
      if (!repo) continue;

      let diffContent = "";
      try {
        const provider = getProvider(repo.providerType);
        diffContent = await provider.getPullRequestDiff(repo.providerRepoId, firstPR.prNumber);
      } catch {
        // If we can't get the diff, skip AI extraction
        continue;
      }

      // Truncate very long diffs for AI context window
      const maxDiffLen = 12000;
      const truncatedDiff =
        diffContent.length > maxDiffLen
          ? `${diffContent.slice(0, maxDiffLen)}\n... [truncated]`
          : diffContent;

      // 4. AI: classify approach and extract anonymized snippet
      let aiResult;
      try {
        aiResult = await callAI({
          systemPrompt: PATTERN_EXTRACTION_SYSTEM_PROMPT,
          userPrompt: buildPatternExtractionPrompt(
            req.title,
            req.description ?? "",
            req.fitGap ?? "general",
            program.targetPlatform ?? "platform_agnostic",
            truncatedDiff,
          ),
          maxTokens: 4096,
        });
      } catch {
        // AI call failed — skip this requirement
        continue;
      }

      _totalPatternTokens += aiResult.totalTokensUsed;

      const extracted = aiResult.data as unknown as PatternExtractionResult;

      // 5. Store anonymized snippet via mutation
      if (extracted.code && extracted.title) {
        await ctx.runMutation(internal.sourceControl.patterns.patternMining.insertSnippet, {
          orgId: program.orgId,
          programId: args.programId,
          title: extracted.title,
          description: extracted.description || req.title,
          code: extracted.code,
          annotations: extracted.annotations,
          requirementCategory: req.fitGap ?? "general",
          targetPlatform: normalizeTargetPlatform(program.targetPlatform ?? ""),
          language: extracted.language || "typescript",
          successRating,
          complexity,
        });
        _patternsExtracted++;
      }
    }

    // Best-effort execution logging
    try {
      await ctx.runMutation(internal.ai.logExecution as any, {
        orgId: program.orgId,
        programId: args.programId,
        executionMode: "platform" as const,
        trigger: "manual" as const,
        taskType: "pattern_mining",
        inputSummary: `${completedReqs.length} completed requirements`,
        outputSummary: `${_patternsExtracted} patterns extracted`,
        tokensUsed: _totalPatternTokens,
        modelId: "claude-sonnet-4-5-20250929",
      });
    } catch {
      /* best-effort */
    }
  },
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

interface PRRecord {
  linesAdded?: number;
  linesRemoved?: number;
  filesChanged?: number;
  mergedAt?: number;
  createdAt?: number;
  _creationTime: number;
}

function computeComplexityMetrics(prs: PRRecord[]) {
  const totalLOC = prs.reduce((sum, pr) => sum + (pr.linesAdded ?? 0) + (pr.linesRemoved ?? 0), 0);
  const totalFiles = prs.reduce((sum, pr) => sum + (pr.filesChanged ?? 0), 0);
  const totalPRs = prs.length;

  return {
    totalLinesChanged: totalLOC,
    totalFilesChanged: totalFiles,
    totalPRs,
    avgLinesPerPR: totalPRs > 0 ? Math.round(totalLOC / totalPRs) : 0,
  };
}

function computeSuccessRating(prs: PRRecord[]): "high" | "medium" | "low" {
  // V1 heuristic: fast merge with few revisions = high success
  const mergeTimes = prs
    .filter((pr) => pr.mergedAt)
    .map((pr) => pr.mergedAt! - (pr.createdAt ?? pr._creationTime));

  if (mergeTimes.length === 0) return "medium";

  const avgMergeTimeHrs =
    mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length / (1000 * 60 * 60);

  // Fast merges (<48h avg) = high, slow merges (>120h avg) = low
  if (avgMergeTimeHrs < 48) return "high";
  if (avgMergeTimeHrs > 120) return "low";
  return "medium";
}

function normalizeTargetPlatform(
  platform: string,
): "salesforce_b2b" | "bigcommerce_b2b" | "sitecore" | "wordpress" | "none" | "platform_agnostic" {
  const lower = platform.toLowerCase();
  if (lower.includes("salesforce")) return "salesforce_b2b";
  if (lower.includes("bigcommerce")) return "bigcommerce_b2b";
  if (lower.includes("sitecore")) return "sitecore";
  if (lower.includes("wordpress")) return "wordpress";
  return "platform_agnostic";
}

interface PatternExtractionResult {
  title: string;
  description: string;
  code: string;
  annotations?: string;
  language: string;
}

function buildPatternExtractionPrompt(
  reqTitle: string,
  reqDescription: string,
  category: string,
  targetPlatform: string,
  diff: string,
): string {
  return `<requirement>
<title>${reqTitle}</title>
<description>${reqDescription}</description>
<category>${category}</category>
<target_platform>${targetPlatform}</target_platform>
</requirement>

<diff>
${diff}
</diff>

Extract a reusable, anonymized code pattern from this PR diff. Follow the anonymization rules strictly.`;
}

const PATTERN_EXTRACTION_SYSTEM_PROMPT = `You are a code pattern mining expert for enterprise platform migrations (Magento → Salesforce B2B Commerce, Magento → BigCommerce B2B).

Given a requirement description and a PR diff, extract the most reusable structural code pattern.

ANONYMIZATION RULES (mandatory):
1. STRIP: company names, product names, internal URLs, API keys, credentials, employee names
2. GENERALIZE: business-specific variable names → generic equivalents (e.g., "acmeOrderId" → "orderId")
3. RETAIN: structural patterns, design patterns, platform-specific API usage, error handling patterns

OUTPUT FORMAT (JSON):
{
  "title": "Short pattern title (e.g., 'B2B Order Sync with Retry')",
  "description": "What this pattern solves and when to use it",
  "code": "The anonymized code snippet (max ~200 lines)",
  "annotations": "Inline comments explaining key decisions",
  "language": "typescript|javascript|apex|liquid|graphql|other"
}

Focus on the STRUCTURAL pattern, not the business logic details.
If the diff doesn't contain a reusable pattern, return an empty code field.`;
