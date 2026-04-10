import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../types";

interface NavigationPlanInput {
  taskTitle: string;
  taskDescription: string;
  requirementText?: string;
  gitDiff?: string;
  changedFiles?: string[];
  baseUrl: string;
}

export interface NavigationRoute {
  url: string;
  description: string;
  waitFor?: string;
  interactions?: Array<{
    action: "click" | "type" | "scroll" | "wait";
    selector?: string;
    value?: string;
    description: string;
  }>;
}

export interface NavigationAssertion {
  description: string;
  type: "visual" | "functional" | "accessibility";
  selector?: string;
  expected?: string;
  route?: string;
}

export interface NavigationPlan {
  routes: NavigationRoute[];
  assertions: NavigationAssertion[];
  reasoning: string;
}

export async function generateNavigationPlan(
  env: Env,
  input: NavigationPlanInput
): Promise<NavigationPlan> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const systemPrompt = `You are a QA verification agent for a web application. Analyze the code changes and generate a comprehensive verification plan.

You will receive details about a completed development task. Generate a navigation plan that:
1. Visits all routes/pages affected by the changes
2. Performs interactions that exercise the new/changed functionality
3. Checks for visual correctness, functional behavior, console errors, and network failures
4. Includes assertions that can be evaluated programmatically

Respond with ONLY valid JSON matching this exact schema:
{
  "routes": [{ "url": "/path", "description": "What this page shows", "waitFor": "optional CSS selector to wait for", "interactions": [{ "action": "click|type|scroll|wait", "selector": "CSS selector", "value": "for type action", "description": "What this does" }] }],
  "assertions": [{ "description": "What to check", "type": "visual|functional|accessibility", "selector": "CSS selector", "expected": "Expected state", "route": "/path where this applies" }],
  "reasoning": "Brief explanation of the verification strategy"
}`;

  const userPrompt = `Task: ${input.taskTitle}
Description: ${input.taskDescription}
${input.requirementText ? `\nRequirement: ${input.requirementText}` : ""}
${input.changedFiles?.length ? `\nChanged Files:\n${input.changedFiles.join("\n")}` : ""}
${input.gitDiff ? `\nGit Diff (truncated to 4000 chars):\n${input.gitDiff.slice(0, 4000)}` : ""}
Base URL: ${input.baseUrl}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI did not return valid JSON navigation plan");
  }

  const parsed = JSON.parse(jsonMatch[0]) as NavigationPlan;

  // Validate minimum structure
  if (!Array.isArray(parsed.routes) || parsed.routes.length === 0) {
    throw new Error("Navigation plan must include at least one route");
  }

  return parsed;
}

export async function generateAiSummary(
  env: Env,
  checks: Array<{ description: string; status: string; aiExplanation?: string }>,
  screenshotCount: number
): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const passed = checks.filter((c) => c.status === "passed").length;
  const failed = checks.filter((c) => c.status === "failed").length;
  const warnings = checks.filter((c) => c.status === "warning").length;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Summarize these verification results in 2-3 sentences:
Checks: ${passed} passed, ${failed} failed, ${warnings} warnings out of ${checks.length} total.
Screenshots: ${screenshotCount} captured.
Details:
${checks.map((c) => `- [${c.status.toUpperCase()}] ${c.description}${c.aiExplanation ? `: ${c.aiExplanation}` : ""}`).join("\n")}

Be concise and actionable. If all passed, say so briefly. If failures exist, highlight the most critical ones.`,
      },
    ],
  });

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
