import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

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
 * Calls the Anthropic Messages API and parses structured JSON output against a Zod schema.
 * Replaces the Express agent-service's SDK-based runAgentQuery with standard HTTP API calls.
 */
export async function runAgentQuery<T>(
  schema: z.ZodType<T>,
  options: AiQueryOptions,
  apiKey: string,
): Promise<AiQueryResult<T>> {
  const client = new Anthropic({ apiKey });

  const model = options.model ?? "claude-sonnet-4-5-20250929";
  const maxTokens = options.maxThinkingTokens ? 16384 : 8192;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: options.prompt }];

  const params: Anthropic.MessageCreateParams = {
    model,
    max_tokens: maxTokens,
    messages,
    ...(options.systemPrompt && { system: options.systemPrompt }),
    ...(options.maxThinkingTokens && {
      thinking: {
        type: "enabled" as const,
        budget_tokens: options.maxThinkingTokens,
      },
    }),
  };

  const message = await client.messages.create(params);

  // Extract text from response content blocks
  let fullMessage = "";
  for (const block of message.content) {
    if (block.type === "text") {
      fullMessage += block.text;
    }
  }

  // Parse JSON from the response
  const jsonMatch = fullMessage.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `No valid JSON found in agent response. fullMessage (${fullMessage.length} chars): ${fullMessage.slice(0, 500)}`,
    );
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const validated = schema.parse(parsed);

  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;

  return {
    data: validated,
    metadata: {
      totalTokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      processedAt: new Date().toISOString(),
    },
  };
}
