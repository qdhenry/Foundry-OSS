import { describe, expect, test } from "vitest";
import {
  calculateCostUsd,
  extractTokenUsage,
  MODEL_PRICING,
  type TokenUsage,
  totalTokens,
} from "../../lib/aiCostTracking";

// ── extractTokenUsage ───────────────────────────────────────────────

describe("extractTokenUsage", () => {
  test("extracts all 4 fields from a complete response", () => {
    const response = {
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 200,
        cache_creation_input_tokens: 100,
      },
    };

    const result = extractTokenUsage(response, "claude-opus-4-6");

    expect(result).toEqual({
      claudeModelId: "claude-opus-4-6",
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 200,
      cacheCreationTokens: 100,
    });
  });

  test("defaults missing cache fields to 0", () => {
    const response = {
      usage: {
        input_tokens: 800,
        output_tokens: 300,
      },
    };

    const result = extractTokenUsage(response, "claude-sonnet-4-5-20250514");

    expect(result).toEqual({
      claudeModelId: "claude-sonnet-4-5-20250514",
      inputTokens: 800,
      outputTokens: 300,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    });
  });

  test("preserves the modelId passed as argument", () => {
    const response = { usage: { input_tokens: 10, output_tokens: 20 } };
    const result = extractTokenUsage(response, "custom-model-id");
    expect(result.claudeModelId).toBe("custom-model-id");
  });
});

// ── calculateCostUsd ────────────────────────────────────────────────

describe("calculateCostUsd", () => {
  test("correct cost for opus (15/75/1.5/18.75 per MTok)", () => {
    const usage: TokenUsage = {
      claudeModelId: "claude-opus-4-6",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    };

    // 15 + 75 + 1.5 + 18.75 = 110.25
    const cost = calculateCostUsd(usage);
    expect(cost).toBeCloseTo(110.25, 6);
  });

  test("correct cost for sonnet (3/15/0.3/3.75 per MTok)", () => {
    const usage: TokenUsage = {
      claudeModelId: "claude-sonnet-4-5-20250514",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    };

    // 3 + 15 + 0.3 + 3.75 = 22.05
    const cost = calculateCostUsd(usage);
    expect(cost).toBeCloseTo(22.05, 6);
  });

  test("sonnet v2 has same pricing as sonnet", () => {
    const usage: TokenUsage = {
      claudeModelId: "claude-sonnet-4-5-20250929",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    };

    const cost = calculateCostUsd(usage);
    expect(cost).toBeCloseTo(22.05, 6);
  });

  test("unknown model falls back to sonnet pricing", () => {
    const usage: TokenUsage = {
      claudeModelId: "unknown-future-model",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadTokens: 1_000_000,
      cacheCreationTokens: 1_000_000,
    };

    // Fallback = sonnet rates = 22.05
    const cost = calculateCostUsd(usage);
    expect(cost).toBeCloseTo(22.05, 6);
  });

  test("calculates fractional cost for small token counts", () => {
    const usage: TokenUsage = {
      claudeModelId: "claude-opus-4-6",
      inputTokens: 500,
      outputTokens: 200,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };

    // (500 * 15 + 200 * 75) / 1_000_000 = (7500 + 15000) / 1_000_000 = 0.0225
    const cost = calculateCostUsd(usage);
    expect(cost).toBeCloseTo(0.0225, 8);
  });

  test("returns 0 for zero tokens", () => {
    const usage: TokenUsage = {
      claudeModelId: "claude-opus-4-6",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };

    expect(calculateCostUsd(usage)).toBe(0);
  });
});

// ── totalTokens ─────────────────────────────────────────────────────

describe("totalTokens", () => {
  test("sums all 4 fields", () => {
    const usage: TokenUsage = {
      claudeModelId: "claude-opus-4-6",
      inputTokens: 100,
      outputTokens: 200,
      cacheReadTokens: 300,
      cacheCreationTokens: 400,
    };

    expect(totalTokens(usage)).toBe(1000);
  });

  test("returns 0 when all fields are 0", () => {
    const usage: TokenUsage = {
      claudeModelId: "claude-opus-4-6",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };

    expect(totalTokens(usage)).toBe(0);
  });
});

// ── MODEL_PRICING ───────────────────────────────────────────────────

describe("MODEL_PRICING", () => {
  test("contains entries for opus and both sonnet models", () => {
    expect(MODEL_PRICING).toHaveProperty("claude-opus-4-6");
    expect(MODEL_PRICING).toHaveProperty("claude-sonnet-4-5-20250514");
    expect(MODEL_PRICING).toHaveProperty("claude-sonnet-4-5-20250929");
  });

  test("opus pricing matches expected values", () => {
    const opus = MODEL_PRICING["claude-opus-4-6"];
    expect(opus.inputPerMTok).toBe(15);
    expect(opus.outputPerMTok).toBe(75);
    expect(opus.cacheReadPerMTok).toBe(1.5);
    expect(opus.cacheCreatePerMTok).toBe(18.75);
  });

  test("sonnet pricing matches expected values", () => {
    const sonnet = MODEL_PRICING["claude-sonnet-4-5-20250514"];
    expect(sonnet.inputPerMTok).toBe(3);
    expect(sonnet.outputPerMTok).toBe(15);
    expect(sonnet.cacheReadPerMTok).toBe(0.3);
    expect(sonnet.cacheCreatePerMTok).toBe(3.75);
  });
});
