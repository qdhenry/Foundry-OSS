/**
 * AI Cost Tracking — shared token usage types, pricing, and cost calculation.
 * Foundation for the aiUsageRecords billing ledger.
 */

export interface TokenUsage {
  claudeModelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/** Per-model pricing in USD per million tokens */
export const MODEL_PRICING: Record<
  string,
  {
    inputPerMTok: number;
    outputPerMTok: number;
    cacheReadPerMTok: number;
    cacheCreatePerMTok: number;
  }
> = {
  "claude-opus-4-6": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheReadPerMTok: 1.5,
    cacheCreatePerMTok: 18.75,
  },
  "claude-sonnet-4-5-20250514": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadPerMTok: 0.3,
    cacheCreatePerMTok: 3.75,
  },
  "claude-sonnet-4-5-20250929": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheReadPerMTok: 0.3,
    cacheCreatePerMTok: 3.75,
  },
};

/** Fallback pricing for unknown models (uses Sonnet rates — conservative estimate) */
const FALLBACK_PRICING = MODEL_PRICING["claude-sonnet-4-5-20250514"];

/**
 * Extract token usage from an Anthropic SDK response (messages.create or messages.stream).
 * Safely handles missing cache fields.
 */
export function extractTokenUsage(
  response: { usage: { input_tokens: number; output_tokens: number } },
  modelId: string,
): TokenUsage {
  const usage = response.usage as Record<string, number>;
  return {
    claudeModelId: modelId,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

/** Calculate cost in USD from token usage */
export function calculateCostUsd(usage: TokenUsage): number {
  const pricing = MODEL_PRICING[usage.claudeModelId] ?? FALLBACK_PRICING;
  return (
    (usage.inputTokens * pricing.inputPerMTok +
      usage.outputTokens * pricing.outputPerMTok +
      usage.cacheReadTokens * pricing.cacheReadPerMTok +
      usage.cacheCreationTokens * pricing.cacheCreatePerMTok) /
    1_000_000
  );
}

/** Sum of all 4 token fields */
export function totalTokens(usage: TokenUsage): number {
  return usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
}
