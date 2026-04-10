import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor(_opts: unknown) {}
    },
  };
});

import { runAgentQuery } from "./ai-service";

const TestSchema = z.object({
  name: z.string(),
  score: z.number(),
});

function makeResponse(text: string, inputTokens = 100, outputTokens = 50) {
  return {
    content: [{ type: "text", text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

describe("runAgentQuery", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("parses JSON from text block response and validates against schema", async () => {
    mockCreate.mockResolvedValue(makeResponse('Here is the result: {"name": "test", "score": 42}'));

    const result = await runAgentQuery(TestSchema, { prompt: "test" }, "sk-key");

    expect(result.data).toEqual({ name: "test", score: 42 });
    expect(result.metadata.inputTokens).toBe(100);
    expect(result.metadata.outputTokens).toBe(50);
    expect(result.metadata.totalTokensUsed).toBe(150);
    expect(result.metadata.processedAt).toBeTruthy();
  });

  it("throws when no JSON is found in response", async () => {
    mockCreate.mockResolvedValue(makeResponse("No JSON here at all"));

    await expect(runAgentQuery(TestSchema, { prompt: "test" }, "sk-key")).rejects.toThrow(
      "No valid JSON found",
    );
  });

  it("throws when JSON does not match Zod schema", async () => {
    mockCreate.mockResolvedValue(makeResponse('{"name": 123, "score": "not-a-number"}'));

    await expect(runAgentQuery(TestSchema, { prompt: "test" }, "sk-key")).rejects.toThrow();
  });

  it("passes thinking tokens config when maxThinkingTokens is set", async () => {
    mockCreate.mockResolvedValue(makeResponse('{"name": "deep", "score": 99}'));

    await runAgentQuery(TestSchema, { prompt: "think hard", maxThinkingTokens: 8000 }, "sk-key");

    const params = mockCreate.mock.calls[0][0];
    expect(params.thinking).toEqual({
      type: "enabled",
      budget_tokens: 8000,
    });
    expect(params.max_tokens).toBe(16384);
  });

  it("uses default model when none specified", async () => {
    mockCreate.mockResolvedValue(makeResponse('{"name": "default", "score": 1}'));

    await runAgentQuery(TestSchema, { prompt: "test" }, "sk-key");

    const params = mockCreate.mock.calls[0][0];
    expect(params.model).toBe("claude-sonnet-4-5-20250929");
  });

  it("uses specified model when provided", async () => {
    mockCreate.mockResolvedValue(makeResponse('{"name": "custom", "score": 2}'));

    await runAgentQuery(TestSchema, { prompt: "test", model: "claude-opus-4-6" }, "sk-key");

    const params = mockCreate.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-4-6");
  });
});
