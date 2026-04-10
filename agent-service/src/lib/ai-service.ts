import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { getApiKey } from "./auth-detector.js";

export interface AiQueryOptions {
  prompt: string;
  systemPrompt?: string;
  maxThinkingTokens?: number;
  model?: string;
}

export interface AiQueryResult<T> {
  data: T;
  metadata: {
    totalTokensUsed: number;
    inputTokens: number;
    outputTokens: number;
    processedAt: string;
  };
}

/**
 * Calls the Anthropic API directly and parses the structured output against the provided Zod schema.
 */
export async function runAgentQuery<T>(
  schema: z.ZodType<T>,
  options: AiQueryOptions,
): Promise<AiQueryResult<T>> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      "No API key configured. Set via POST /auth/api-key or ANTHROPIC_API_KEY env var.",
    );
  }

  const client = new Anthropic({ apiKey });

  const model = options.model ?? "claude-sonnet-4-5-20250929";
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: options.prompt }];

  const requestParams: Anthropic.MessageCreateParams = {
    model,
    max_tokens: 16384,
    messages,
    ...(options.systemPrompt && { system: options.systemPrompt }),
    ...(options.maxThinkingTokens && {
      thinking: {
        type: "enabled" as const,
        budget_tokens: options.maxThinkingTokens,
      },
    }),
  };

  const response = await client.messages.create(requestParams);

  let fullMessage = "";
  for (const block of response.content) {
    if (block.type === "text") {
      fullMessage += block.text;
    }
  }

  const totalInputTokens = response.usage.input_tokens;
  const totalOutputTokens = response.usage.output_tokens;

  // Parse the JSON from the response
  const jsonMatch = fullMessage.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `No valid JSON found in response. Response (${fullMessage.length} chars): ${fullMessage.slice(0, 500)}`,
    );
  }

  const parsed = JSON.parse(jsonMatch[0]);
  console.log(`[sdk] parsed JSON keys: ${Object.keys(parsed)}`);
  if (parsed.nodes?.[0]) console.log(`[sdk] first node keys: ${Object.keys(parsed.nodes[0])}`);
  if (parsed.edges?.[0]) console.log(`[sdk] first edge keys: ${Object.keys(parsed.edges[0])}`);
  if (parsed.tours?.[0]) console.log(`[sdk] first tour keys: ${Object.keys(parsed.tours[0])}`);
  if (parsed.summary) console.log(`[sdk] summary keys: ${Object.keys(parsed.summary)}`);
  const validated = schema.parse(parsed);

  return {
    data: validated,
    metadata: {
      totalTokensUsed: totalInputTokens + totalOutputTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      processedAt: new Date().toISOString(),
    },
  };
}
