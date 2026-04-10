import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { callAI, getAnthropicClient } from "../lib/aiClient";

// Mock the Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn();
  MockAnthropic.prototype.messages = {
    create: vi.fn(),
  };
  return { default: MockAnthropic };
});

import Anthropic from "@anthropic-ai/sdk";

const MockAnthropic = Anthropic as unknown as ReturnType<typeof vi.fn>;

describe("getAnthropicClient", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    vi.clearAllMocks();
  });

  test("throws with clear message when ANTHROPIC_API_KEY is not set", () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => getAnthropicClient()).toThrowError(/ANTHROPIC_API_KEY is not configured/);
  });

  test("returns an Anthropic instance when key is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";

    const client = getAnthropicClient();
    expect(client).toBeInstanceOf(Anthropic);
  });

  test("passes the API key to the SDK constructor", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";

    getAnthropicClient();

    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: "sk-test-key" });
  });
});

describe("callAI", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-test-key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  function mockMessagesCreate(response: unknown) {
    MockAnthropic.prototype.messages.create = vi.fn().mockResolvedValue(response);
  }

  test("returns parsed JSON and token count on success", async () => {
    mockMessagesCreate({
      stop_reason: "end_turn",
      content: [{ type: "text", text: '{"result": "success", "count": 42}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await callAI({
      systemPrompt: "You are a test assistant.",
      userPrompt: "Return some JSON.",
    });

    expect(result.data).toEqual({ result: "success", count: 42 });
    expect(result.totalTokensUsed).toBe(150);
  });

  test("throws on truncated response (stop_reason: max_tokens)", async () => {
    mockMessagesCreate({
      stop_reason: "max_tokens",
      content: [{ type: "text", text: '{"partial": true' }],
      usage: { input_tokens: 100, output_tokens: 8192 },
    });

    await expect(callAI({ systemPrompt: "test", userPrompt: "test" })).rejects.toThrowError(
      /truncated/i,
    );
  });

  test("throws when AI response contains no JSON", async () => {
    mockMessagesCreate({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "I cannot produce JSON for this request." }],
      usage: { input_tokens: 50, output_tokens: 20 },
    });

    await expect(callAI({ systemPrompt: "test", userPrompt: "test" })).rejects.toThrowError(
      /No valid JSON/,
    );
  });
});
