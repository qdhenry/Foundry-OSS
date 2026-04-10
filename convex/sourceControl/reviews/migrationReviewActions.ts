// @ts-nocheck
"use node";

import type Anthropic from "@anthropic-ai/sdk";
import { ConvexError, v } from "convex/values";
import { internal } from "../../_generated/api";
import { action } from "../../_generated/server";
import { getAnthropicClient } from "../../lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "../../lib/aiCostTracking";
import { getProvider } from "../factory";
import type { GitHubProvider } from "../providers/github";
import type { PRReviewResult, ReviewPayload } from "../types";
import { formatMigrationContext } from "./contextAssembly";

/**
 * Migration-context AI code review — action orchestration.
 *
 * Fetches PR diff, assembles migration context, calls Claude for structured
 * review, posts to GitHub, and stores results.
 */

const MAX_REVIEW_LINES = 10_000;
const _REVIEW_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Helper: get authenticated provider
// ---------------------------------------------------------------------------

async function getAuthedProvider(ctx: any, repositoryId: string) {
  const { repo, installation } = await ctx.runQuery(
    internal.sourceControl.mcp.queries.getRepoWithInstallation,
    { repositoryId },
  );

  const provider = getProvider(repo.providerType);

  let token = await ctx.runQuery(internal.sourceControl.mcp.queries.getCachedToken, {
    installationId: installation.installationId,
  });

  if (!token) {
    const tokenResult = await provider.getInstallationToken(installation.installationId);
    token = tokenResult.token;
    await ctx.runMutation(internal.sourceControl.mcp.queries.upsertToken, {
      installationId: installation.installationId,
      token: tokenResult.token,
      expiresAt: tokenResult.expiresAt,
    });
  }

  (provider as GitHubProvider).setToken(token);
  return { provider, repo };
}

// ---------------------------------------------------------------------------
// requestMigrationReview — trigger an AI code review for a PR
// ---------------------------------------------------------------------------

export const requestMigrationReview = action({
  args: {
    prId: v.id("sourceControlPullRequests"),
    requestedBy: v.string(),
    triggerMethod: v.union(
      v.literal("platform_button"),
      v.literal("github_comment"),
      v.literal("bulk_review"),
    ),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    // 1. Load PR data and validate
    const { pr, repo, program } = await ctx.runQuery(
      internal.sourceControl.reviews.migrationReview.getPRForReview,
      { prId: args.prId },
    );

    if (!program) throw new ConvexError("Program not found for this PR");

    // Validate line count hard cap
    const totalLines = pr.additions + pr.deletions;
    if (totalLines > MAX_REVIEW_LINES) {
      throw new ConvexError(
        `PR #${pr.prNumber} has ${totalLines} lines changed, exceeding the ${MAX_REVIEW_LINES}-line review cap. ` +
          `Consider splitting into smaller PRs for meaningful review.`,
      );
    }

    // 2. Create pending review record
    const reviewId = await ctx.runMutation(
      internal.sourceControl.reviews.migrationReview.createReview,
      {
        orgId: pr.orgId,
        prId: args.prId,
        taskId: pr.taskId,
        requestedBy: args.requestedBy,
        triggerMethod: args.triggerMethod,
      },
    );

    // 3. Mark as in progress
    await ctx.runMutation(internal.sourceControl.reviews.migrationReview.markReviewInProgress, {
      reviewId,
    });

    try {
      // 4. Fetch PR diff via provider
      const { provider } = await getAuthedProvider(ctx, pr.repositoryId);
      const diff = await provider.getPullRequestDiff(repo.repoFullName, pr.prNumber);

      // Truncate if needed
      const diffLines = diff.split("\n");
      const truncatedDiff =
        diffLines.length > MAX_REVIEW_LINES
          ? diffLines.slice(0, MAX_REVIEW_LINES).join("\n") +
            `\n\n[Diff truncated from ${diffLines.length} to ${MAX_REVIEW_LINES} lines]`
          : diff;

      // 5. Assemble migration context
      const contextData = await ctx.runQuery(
        internal.sourceControl.reviews.contextAssembly.getReviewContextData,
        { prId: args.prId },
      );

      const migrationContext = formatMigrationContext({
        program: contextData.program,
        task: contextData.task,
        requirement: contextData.requirement,
        workstream: contextData.workstream,
        relatedRequirements: contextData.relatedRequirements,
        snippets: contextData.snippets,
      });

      // 6. Call Claude API
      const client = getAnthropicClient();

      const contextBlock = [
        migrationContext.requirementContext,
        migrationContext.platformPatterns,
        migrationContext.relatedRequirements,
        migrationContext.snippets,
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 8192,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `<migration_context>\n${contextBlock}\n</migration_context>`,
                cache_control: { type: "ephemeral" },
              },
              {
                type: "text",
                text: buildUserPrompt(pr, truncatedDiff, args.requestedBy),
              },
            ],
          },
        ],
      });

      // 7. Parse structured result
      const outputText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in AI review response");
      }

      const reviewResult: PRReviewResult = JSON.parse(jsonMatch[0]);

      const tokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: (response.usage as any).cache_read_input_tokens ?? 0,
        cacheCreationTokens: (response.usage as any).cache_creation_input_tokens ?? 0,
      };

      // 8. Post review to GitHub
      const reviewPayload = buildGitHubReview(reviewResult, args.requestedBy);

      let githubReviewId: number | undefined;
      try {
        const posted = await provider.postPullRequestReview(
          repo.repoFullName,
          pr.prNumber,
          reviewPayload,
        );
        githubReviewId = posted.reviewId;
      } catch (postError) {
        // Log but don't fail the review if GitHub posting fails
        console.error(
          "[review] Failed to post review to GitHub:",
          postError instanceof Error ? postError.message : postError,
        );
      }

      // 9. Store completed review
      const durationMs = Date.now() - startTime;
      await ctx.runMutation(internal.sourceControl.reviews.migrationReview.completeReview, {
        reviewId,
        result: reviewResult,
        githubReviewId,
        tokenUsage: { ...tokenUsage, durationMs },
      });

      // 10. Record AI usage for billing (best-effort)
      try {
        const billingUsage = extractTokenUsage(response, "claude-sonnet-4-5-20250929");
        await ctx.runMutation(internal.billing.usageRecords.recordAiUsage, {
          orgId: pr.orgId,
          programId: program._id,
          source: "pr_review" as const,
          claudeModelId: "claude-sonnet-4-5-20250929",
          inputTokens: billingUsage.inputTokens,
          outputTokens: billingUsage.outputTokens,
          cacheReadTokens: billingUsage.cacheReadTokens,
          cacheCreationTokens: billingUsage.cacheCreationTokens,
          costUsd: calculateCostUsd(billingUsage),
          durationMs,
          sourceEntityId: String(args.prId),
          sourceEntityTable: "sourceControlPullRequests",
        });
      } catch (e) {
        console.error("[billing] Failed to record PR review usage:", e);
      }

      return {
        reviewId,
        result: reviewResult,
        githubReviewId,
        durationMs,
        tokenUsage,
      };
    } catch (error) {
      // Record failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      await ctx.runMutation(internal.sourceControl.reviews.migrationReview.failReview, {
        reviewId,
        error: errorMessage,
      });
      throw error;
    }
  },
});

// ---------------------------------------------------------------------------
// System prompt for migration-context code review
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert migration-context code reviewer for enterprise platform migrations.

Your role is to review pull request diffs against the specific migration requirement, target platform patterns, and historical learnings from past migrations. You provide actionable, context-aware feedback that generic code review tools cannot.

You MUST respond with a single JSON object matching this exact schema:

{
  "overall_assessment": "approve" | "request_changes" | "comment",
  "requirement_alignment": {
    "score": <number 0-100>,
    "covered_criteria": [<string[]>],
    "missing_criteria": [<string[]>],
    "scope_concerns": [<string[]>]
  },
  "platform_specific_issues": [
    {
      "file": "<filename>",
      "line": <line number>,
      "severity": "critical" | "warning" | "suggestion",
      "issue": "<description>",
      "recommendation": "<fix>",
      "pattern_source": "<optional: which pattern this relates to>"
    }
  ],
  "migration_risks": [
    {
      "risk": "<risk description>",
      "impact": "<impact if not addressed>",
      "mitigation": "<recommended fix>"
    }
  ],
  "pattern_matches": [
    {
      "pattern_id": "<snippet id or pattern name>",
      "description": "<what matched>",
      "relevance": "<why relevant>",
      "recommendation": "<suggested action>"
    }
  ],
  "branch_deviation_note": "<optional: note if PR targets unexpected branch>",
  "summary": "<2-3 sentence executive summary>"
}

Guidelines:
- Focus on migration-specific issues, not generic code style
- Reference specific requirement criteria when assessing alignment
- Flag platform-specific anti-patterns (governor limits, API conventions, etc.)
- Compare against historical patterns when available
- Be concise but specific — cite file and line numbers
- If the diff is too large or unclear, note limitations honestly`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

function buildUserPrompt(pr: any, diff: string, requestedBy: string): string {
  return `Review this pull request in the context of the migration described above.

<pull_request>
  <number>${pr.prNumber}</number>
  <title>${pr.title}</title>
  <author>${pr.authorLogin}</author>
  <source_branch>${pr.sourceBranch}</source_branch>
  <target_branch>${pr.targetBranch}</target_branch>
  <files_changed>${pr.filesChanged}</files_changed>
  <additions>${pr.additions}</additions>
  <deletions>${pr.deletions}</deletions>
</pull_request>

<diff>
${diff}
</diff>

Review requested by: ${requestedBy}

Analyze this diff against the migration context provided. Return your review as a JSON object matching the schema described in your instructions.`;
}

// ---------------------------------------------------------------------------
// Build GitHub review payload from AI result
// ---------------------------------------------------------------------------

function buildGitHubReview(result: PRReviewResult, requestedBy: string): ReviewPayload {
  // Map our assessment to GitHub review event
  const eventMap: Record<string, ReviewPayload["event"]> = {
    approve: "APPROVE",
    request_changes: "REQUEST_CHANGES",
    comment: "COMMENT",
  };

  // Build review body with user attribution
  const bodyParts: string[] = [
    `**Migration Platform Review** — Requested by @${requestedBy}`,
    "",
    `### ${result.summary}`,
    "",
    `**Requirement Alignment:** ${result.requirement_alignment.score}/100`,
  ];

  if (result.requirement_alignment.missing_criteria.length > 0) {
    bodyParts.push(
      "",
      "**Missing Criteria:**",
      ...result.requirement_alignment.missing_criteria.map((c) => `- ${c}`),
    );
  }

  if (result.migration_risks.length > 0) {
    bodyParts.push(
      "",
      "**Migration Risks:**",
      ...result.migration_risks.map(
        (r) => `- **${r.risk}** — ${r.impact}. *Mitigation:* ${r.mitigation}`,
      ),
    );
  }

  if (result.branch_deviation_note) {
    bodyParts.push("", `> ${result.branch_deviation_note}`);
  }

  // Build inline comments from platform-specific issues
  const comments = result.platform_specific_issues
    .filter((issue) => issue.file && issue.line > 0)
    .map((issue) => ({
      path: issue.file,
      line: issue.line,
      body: `**[${issue.severity.toUpperCase()}]** ${issue.issue}\n\n${issue.recommendation}${
        issue.pattern_source ? `\n\n_Pattern: ${issue.pattern_source}_` : ""
      }`,
    }));

  return {
    body: bodyParts.join("\n"),
    event: eventMap[result.overall_assessment] ?? "COMMENT",
    comments,
  };
}
