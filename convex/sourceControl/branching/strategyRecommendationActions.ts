// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { getAnthropicClient } from "../../lib/aiClient";
import { calculateCostUsd, extractTokenUsage, totalTokens } from "../../lib/aiCostTracking";
import { extractCompletedObjects } from "../../lib/streamingJsonParser";
import { getProvider } from "../factory";
import type { BranchStrategyRecommendation } from "../types";

/**
 * AI-powered branch strategy recommendation action (Node.js runtime).
 *
 * Assembles context from workstream dependencies, task decompositions,
 * team assignments, repo structure, and sprint overlaps, then calls
 * Claude to generate an optimal branching strategy.
 */

// ---------------------------------------------------------------------------
// generateBranchStrategy — AI action to create branch strategy
// ---------------------------------------------------------------------------

export const generateBranchStrategy = internalAction({
  args: {
    programId: v.id("programs"),
    sprintId: v.id("sprints"),
    placeholderId: v.id("sprintPlanningRecommendations"),
  },
  handler: async (ctx, args) => {
    try {
      await ctx.runMutation(
        internal.sourceControl.branching.strategyRecommendation.updateStrategyProgress,
        { placeholderId: args.placeholderId, progress: "Gathering strategy context..." },
      );

      // 1. Load context
      const context = await ctx.runQuery(
        internal.sourceControl.branching.strategyRecommendation.getStrategyContext,
        { programId: args.programId, sprintId: args.sprintId },
      );

      if (!context) {
        console.log("[branch-strategy] Missing program or sprint context");
        await ctx.runMutation(
          internal.sourceControl.branching.strategyRecommendation.markStrategyError,
          { placeholderId: args.placeholderId, error: "Missing program or sprint context" },
        );
        return;
      }

      const {
        program,
        sprint,
        workstreams,
        dependencies,
        tasks,
        taskDecompositions,
        teamMembers,
        repos,
        overlappingSprints,
      } = context;

      if (repos.length === 0) {
        await ctx.runMutation(
          internal.sourceControl.branching.strategyRecommendation.markStrategyError,
          { placeholderId: args.placeholderId, error: "No connected repositories" },
        );
        return;
      }

      if (tasks.length === 0) {
        await ctx.runMutation(
          internal.sourceControl.branching.strategyRecommendation.markStrategyError,
          { placeholderId: args.placeholderId, error: "No tasks in sprint" },
        );
        return;
      }

      await ctx.runMutation(
        internal.sourceControl.branching.strategyRecommendation.updateStrategyProgress,
        {
          placeholderId: args.placeholderId,
          progress: "Analyzing repositories and generating strategy...",
        },
      );

      // 2. Fetch repo file trees for context (top-level only to limit tokens)
      const repoStructures: Array<{ repo: string; tree: string }> = [];
      for (const repo of repos) {
        try {
          const provider = getProvider(repo.providerType);
          const _token = await provider.getInstallationToken(repo.installationId);
          const tree = await provider.getRepoStructure(repo.repoFullName);
          const treeStr = tree
            .map((n) => `${n.type === "directory" ? "d" : "f"} ${n.path}`)
            .join("\n");
          repoStructures.push({ repo: repo.repoFullName, tree: treeStr });
        } catch (error) {
          console.log(
            `[branch-strategy] Could not fetch tree for ${repo.repoFullName}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }

      // 3. Build prompt sections
      const workstreamMap = new Map(workstreams.map((w) => [w._id, w]));

      const workstreamSection = workstreams
        .map((w) => `- ${w.shortCode}: ${w.name} (${w.status})`)
        .join("\n");

      const depSection =
        dependencies.length > 0
          ? dependencies
              .map((d) => {
                const src = workstreamMap.get(d.sourceWorkstreamId);
                const tgt = workstreamMap.get(d.targetWorkstreamId);
                return `- ${src?.shortCode ?? "?"} ${d.dependencyType ?? "→"} ${tgt?.shortCode ?? "?"}: ${d.description ?? ""}`;
              })
              .join("\n")
          : "No cross-workstream dependencies defined.";

      const taskSection = tasks
        .map((t) => {
          const ws = t.workstreamId ? workstreamMap.get(t.workstreamId) : null;
          return `- [${t._id}] ${t.title} (${ws?.shortCode ?? "no-ws"}, ${t.priority}, ${t.status})`;
        })
        .join("\n");

      const decompositionSection =
        taskDecompositions.length > 0
          ? taskDecompositions
              .map((td) => {
                const ws = td.workstreamId ? workstreamMap.get(td.workstreamId) : null;
                const decomp = td.decomposition as Record<string, any> | null;
                const files =
                  decomp?.predictedFiles?.join(", ") ??
                  decomp?.files?.join(", ") ??
                  "no file predictions";
                return `- ${td.taskTitle} (${ws?.shortCode ?? "?"}): ${files}`;
              })
              .join("\n")
          : "No task decompositions with file predictions available.";

      const teamSection = teamMembers
        .map((tm) => {
          const wsIds = tm.workstreamIds ?? [];
          const wsNames = wsIds.map((id) => workstreamMap.get(id)?.shortCode ?? "?").join(", ");
          return `- ${tm.role}: workstreams [${wsNames}]`;
        })
        .join("\n");

      const repoSection = repos
        .map(
          (r) =>
            `- ${r.repoFullName} (${r.role}, default: ${r.defaultBranch}${r.isMonorepo ? ", monorepo" : ""})`,
        )
        .join("\n");

      const treeSection =
        repoStructures.length > 0
          ? repoStructures.map((r) => `### ${r.repo}\n${r.tree}`).join("\n\n")
          : "File trees not available.";

      const overlapSection =
        overlappingSprints.length > 0
          ? overlappingSprints
              .map(
                (s) =>
                  `- ${s.name} (${s.status}): ${new Date(s.startDate ?? 0).toISOString().slice(0, 10)} → ${new Date(s.endDate ?? 0).toISOString().slice(0, 10)}`,
              )
              .join("\n")
          : "No overlapping sprints.";

      const systemPrompt = `You are an expert software architect specializing in branching strategies for enterprise migration projects. You analyze workstream dependencies, task file predictions, and team structure to recommend optimal branching strategies that minimize merge conflicts and maximize parallel development velocity.`;

      const userPrompt = `Analyze this migration sprint and recommend a branching strategy.

<program>
${program.name} — ${program.sourcePlatform} → ${program.targetPlatform} (${program.phase} phase)
</program>

<sprint>
${sprint.name} (${sprint.status})
${sprint.startDate ? `Start: ${new Date(sprint.startDate).toISOString().slice(0, 10)}` : ""}
${sprint.endDate ? `End: ${new Date(sprint.endDate).toISOString().slice(0, 10)}` : ""}
${sprint.goal ? `Goal: ${sprint.goal}` : ""}
</sprint>

<workstreams>
${workstreamSection}
</workstreams>

<workstream_dependencies>
${depSection}
</workstream_dependencies>

<sprint_tasks>
${taskSection}
</sprint_tasks>

<task_decompositions_and_file_predictions>
${decompositionSection}
</task_decompositions_and_file_predictions>

<team_assignments>
${teamSection}
</team_assignments>

<repositories>
${repoSection}
</repositories>

<repository_file_trees>
${treeSection}
</repository_file_trees>

<overlapping_sprints>
${overlapSection}
</overlapping_sprints>

Recommend a branching strategy. Respond with a JSON object matching this structure:
{
  "strategy_type": "feature_branches" | "workstream_branches" | "shared_integration" | "trunk_based",
  "rationale": "Why this strategy is optimal for the given context",
  "recommended_branches": [
    {
      "branch_name": "descriptive/branch-name",
      "purpose": "What this branch is for",
      "parent_branch": "main or other parent",
      "workstreams": ["WS-CODE-1", "WS-CODE-2"],
      "tasks": ["task-id-1", "task-id-2"],
      "merge_timing": "When to merge (e.g., 'end of sprint', 'after integration test')"
    }
  ],
  "overlap_warnings": [
    {
      "file_or_module": "path/to/conflicting/area",
      "workstreams": ["WS1", "WS2"],
      "conflict_risk": "high" | "medium" | "low",
      "recommendation": "How to mitigate"
    }
  ],
  "merge_order": [
    {
      "branch": "branch-name",
      "merge_into": "target-branch",
      "order": 1,
      "rationale": "Why this order"
    }
  ],
  "integration_points": [
    {
      "description": "Integration milestone description",
      "timing": "When",
      "branches_involved": ["branch-1", "branch-2"]
    }
  ]
}

Key considerations:
- If workstreams touch overlapping files, prefer shared integration branches
- If tasks are isolated by module, feature branches per task may suffice
- If there are dependency chains between workstreams, order merges accordingly
- For monorepos with path filters, branches may scope to specific paths
- Consider team size and review bottlenecks when recommending branch count`;

      // 4. Stream the AI response
      const client = getAnthropicClient();
      const stream = client.messages.stream({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      let fullText = "";
      let branchCount = 0;

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;

          const extracted = extractCompletedObjects(fullText, "recommended_branches", branchCount);

          for (const branch of extracted.newObjects) {
            await ctx.runMutation(
              internal.sourceControl.branching.strategyRecommendation.appendRecommendedBranch,
              {
                placeholderId: args.placeholderId,
                branch,
                branchIndex: branchCount,
              },
            );
            branchCount++;
          }
        }
      }

      // 5. Final flush
      const finalExtracted = extractCompletedObjects(fullText, "recommended_branches", branchCount);
      for (const branch of finalExtracted.newObjects) {
        await ctx.runMutation(
          internal.sourceControl.branching.strategyRecommendation.appendRecommendedBranch,
          {
            placeholderId: args.placeholderId,
            branch,
            branchIndex: branchCount,
          },
        );
        branchCount++;
      }

      // 6. Parse full response
      let fullStrategy: Record<string, unknown> | null = null;
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          fullStrategy = JSON.parse(jsonMatch[0]);
        } catch {
          // Fall back to whatever we streamed
        }
      }

      if (!fullStrategy) {
        fullStrategy = { recommended_branches: [] };
      }

      // 7. Token counts
      const finalMessage = await stream.finalMessage();
      const usage = extractTokenUsage(finalMessage, "claude-sonnet-4-5-20250929");
      const _costUsd = calculateCostUsd(usage);
      const tokenCount = totalTokens(usage);

      // 8. Finalize
      await ctx.runMutation(
        internal.sourceControl.branching.strategyRecommendation.finalizeStrategy,
        {
          placeholderId: args.placeholderId,
          branchStrategy: fullStrategy,
          totalTokensUsed: tokenCount,
        },
      );

      // Best-effort execution logging
      try {
        await ctx.runMutation((internal as any).ai.logExecution, {
          orgId: program.orgId,
          programId: args.programId,
          executionMode: "platform" as const,
          trigger: "manual" as const,
          taskType: "branch_strategy",
          inputSummary: userPrompt.slice(0, 200),
          outputSummary: `${(fullStrategy as any).strategy_type ?? "unknown"} strategy, ${branchCount} branches`,
          tokensUsed: tokenCount,
          modelId: "claude-sonnet-4-5-20250929",
        });
      } catch {
        /* best-effort */
      }

      console.log(
        `[branch-strategy] Generated ${(fullStrategy as any).strategy_type ?? "unknown"} strategy: ${branchCount} branches streamed`,
      );
    } catch (error) {
      console.error("[branch-strategy] Generation failed:", error);
      await ctx.runMutation(
        internal.sourceControl.branching.strategyRecommendation.markStrategyError,
        {
          placeholderId: args.placeholderId,
          error:
            error instanceof Error
              ? error.message
              : "Unknown error during branch strategy generation",
        },
      );
    }
  },
});

// ---------------------------------------------------------------------------
// createRecommendedBranches — opt-in auto-branch creation via provider API
// ---------------------------------------------------------------------------

export const createRecommendedBranches = internalAction({
  args: {
    programId: v.id("programs"),
    sprintId: v.id("sprints"),
  },
  handler: async (ctx, args) => {
    // 1. Load the recommendation
    const rec = await ctx.runQuery(
      internal.sourceControl.branching.strategyRecommendation.getRecommendationForDeviation,
      { sprintId: args.sprintId },
    );

    if (!rec?.branchStrategy) {
      console.log("[branch-strategy] No recommendation found for branch creation");
      return { created: [] };
    }

    const strategy = rec.branchStrategy as BranchStrategyRecommendation;

    // 2. Load repos for this program
    const context = await ctx.runQuery(
      internal.sourceControl.branching.strategyRecommendation.getStrategyContext,
      { programId: args.programId, sprintId: args.sprintId },
    );
    if (!context || context.repos.length === 0) {
      return { created: [] };
    }

    const created: string[] = [];

    // 3. Create branches on each repo
    for (const repo of context.repos) {
      const provider = getProvider(repo.providerType);

      for (const branch of strategy.recommended_branches) {
        try {
          await provider.createBranch(repo.repoFullName, branch.branch_name, branch.parent_branch);
          created.push(`${repo.repoFullName}:${branch.branch_name}`);
          console.log(
            `[branch-strategy] Created branch ${branch.branch_name} on ${repo.repoFullName}`,
          );
        } catch (error) {
          // Branch may already exist — that's OK
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("422") || msg.includes("already exists")) {
            console.log(
              `[branch-strategy] Branch ${branch.branch_name} already exists on ${repo.repoFullName}`,
            );
          } else {
            console.error(
              `[branch-strategy] Failed to create ${branch.branch_name} on ${repo.repoFullName}: ${msg}`,
            );
          }
        }
      }
    }

    return { created };
  },
});
