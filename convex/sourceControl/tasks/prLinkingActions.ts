// @ts-nocheck
"use node";

import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { getAnthropicClient } from "../../lib/aiClient";

/**
 * AI-powered PR-to-task inference action (Node.js runtime).
 *
 * Uses Claude to match PR context (title, body, branch, files) against
 * task descriptions. Outputs confidence 0-100. Auto-links if >= 90.
 */

export const inferTaskLink = internalAction({
  args: {
    prId: v.id("sourceControlPullRequests"),
    programId: v.id("programs"),
  },
  handler: async (ctx, args) => {
    // 1. Load PR
    const pr = await ctx.runQuery(internal.sourceControl.tasks.prLinking.getPRWithLinks, {
      prId: args.prId,
    });
    if (!pr || pr.taskId) return; // Already linked

    // 2. Load tasks for the program
    const tasks = await ctx.runQuery(internal.sourceControl.tasks.prTracking.getTasksByProgram, {
      programId: args.programId,
    });
    if (tasks.length === 0) return;

    // 3. Build prompt for Claude
    const prContext = [
      `PR #${pr.prNumber}: ${pr.title}`,
      `Branch: ${pr.sourceBranch} → ${pr.targetBranch}`,
      `Author: ${pr.authorLogin}`,
      pr.body ? `Description: ${pr.body.slice(0, 1000)}` : "",
      `Files changed: ${pr.filesChanged}, +${pr.additions}/-${pr.deletions}`,
    ]
      .filter(Boolean)
      .join("\n");

    const taskList = tasks
      .map(
        (t) =>
          `- ID: ${t._id} | Title: ${t.title}${t.description ? ` | Desc: ${t.description.slice(0, 200)}` : ""}`,
      )
      .join("\n");

    const prompt = `You are matching a GitHub Pull Request to the most relevant task in a migration project.

<pr>
${prContext}
</pr>

<tasks>
${taskList}
</tasks>

Which task is this PR most likely implementing? Respond with a JSON object:
- "taskId": the task ID string (or null if no match)
- "confidence": 0-100 (how confident you are)
- "reasoning": brief explanation

Only match if genuinely related (confidence >= 50). If unsure, return null for taskId with low confidence.`;

    try {
      const anthropic = getAnthropicClient();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250514",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log("[pr-linking] No JSON found in AI response");
        return;
      }

      const result = JSON.parse(jsonMatch[0]);
      const { taskId, confidence } = result;

      if (!taskId || confidence < 50) {
        console.log(
          `[pr-linking] AI inference: no confident match for PR #${pr.prNumber} (confidence: ${confidence ?? 0})`,
        );
        return;
      }

      // Verify the task ID is valid
      const validTask = tasks.find((t) => t._id.toString() === taskId);
      if (!validTask) {
        console.log(`[pr-linking] AI returned invalid task ID: ${taskId}`);
        return;
      }

      // Auto-link if confidence >= 90, otherwise just store as suggestion
      if (confidence >= 90) {
        await ctx.runMutation(internal.sourceControl.tasks.prLinking.applyInferredLink, {
          prId: args.prId,
          taskId: validTask._id,
          linkMethod: "ai_inference",
          linkConfidence: confidence,
        });
        console.log(
          `[pr-linking] Auto-linked PR #${pr.prNumber} → task ${taskId} (confidence: ${confidence})`,
        );
      } else {
        // Store as suggestion with lower confidence — UI shows as "suggested"
        await ctx.runMutation(internal.sourceControl.tasks.prLinking.applyInferredLink, {
          prId: args.prId,
          taskId: validTask._id,
          linkMethod: "ai_inference",
          linkConfidence: confidence,
        });
        console.log(
          `[pr-linking] Suggested link: PR #${pr.prNumber} → task ${taskId} (confidence: ${confidence})`,
        );
      }
    } catch (error) {
      console.error(
        `[pr-linking] AI inference failed for PR #${pr.prNumber}:`,
        error instanceof Error ? error.message : error,
      );
    }
  },
});
