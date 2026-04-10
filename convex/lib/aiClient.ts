import Anthropic from "@anthropic-ai/sdk";
import {
  calculateCostUsd,
  extractTokenUsage,
  type TokenUsage,
  totalTokens,
} from "./aiCostTracking";

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Set it in the Convex dashboard: npx convex env set ANTHROPIC_API_KEY <key>",
    );
  }
  return new Anthropic({ apiKey });
}

export interface AiCallResult {
  data: Record<string, unknown>;
  usage: TokenUsage;
  costUsd: number;
  totalTokensUsed: number; // backward compat
}

const CALL_AI_MODEL = "claude-sonnet-4-5-20250929";

export async function callAI(opts: {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<AiCallResult> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CALL_AI_MODEL,
    max_tokens: opts.maxTokens ?? 8192,
    system: opts.systemPrompt,
    messages: [{ role: "user", content: opts.userPrompt }],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error("AI response was truncated. Reduce input context or simplify the request.");
  }

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in AI response");
  }

  const usage = extractTokenUsage(response, CALL_AI_MODEL);
  const costUsd = calculateCostUsd(usage);
  const totalTokensUsed = totalTokens(usage);

  try {
    return { data: JSON.parse(jsonMatch[0]), usage, costUsd, totalTokensUsed };
  } catch (_parseError) {
    throw new Error(
      `Failed to parse AI JSON response (${text.length} chars, stop_reason: ${response.stop_reason}). ` +
        `Tail: ...${jsonMatch[0].slice(-200)}`,
    );
  }
}
