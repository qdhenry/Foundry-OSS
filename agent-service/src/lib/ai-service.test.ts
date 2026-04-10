import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock the auth-detector module
vi.mock("./auth-detector.js", () => ({
  detectAuthStatus: vi.fn(),
  getApiKey: vi.fn(),
}));

// Mock the agent SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("runAgentQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("throws when no API key is configured", async () => {
    const { detectAuthStatus } = await import("./auth-detector.js");
    vi.mocked(detectAuthStatus).mockResolvedValue({
      source: "none",
      isConfigured: false,
      claudeCodeInstalled: false,
    });

    const { runAgentQuery } = await import("./ai-service.js");
    const schema = z.object({ result: z.string() });

    await expect(runAgentQuery(schema, { prompt: "test" })).rejects.toThrow(
      "No API key configured",
    );
  });

  it("calls SDK query with correct parameters when API key exists", async () => {
    const { detectAuthStatus, getApiKey } = await import("./auth-detector.js");
    vi.mocked(detectAuthStatus).mockResolvedValue({
      source: "env_var",
      isConfigured: true,
      claudeCodeInstalled: false,
      apiKeyPrefix: "sk-ant-api...",
    });
    vi.mocked(getApiKey).mockResolvedValue("sk-ant-api-key-123");

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    const mockEvents = [
      {
        type: "assistant",
        message: {
          content: [{ type: "text", text: '{"result": "hello"}' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        },
      },
      {
        type: "result",
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    ];

    vi.mocked(query).mockReturnValue(
      (async function* () {
        for (const event of mockEvents) {
          yield event;
        }
      })() as any,
    );

    const { runAgentQuery } = await import("./ai-service.js");
    const schema = z.object({ result: z.string() });

    const result = await runAgentQuery(schema, {
      prompt: "test prompt",
      systemPrompt: "system prompt",
      maxThinkingTokens: 5000,
    });

    expect(result.data).toEqual({ result: "hello" });
    expect(result.metadata.inputTokens).toBe(10);
    expect(result.metadata.outputTokens).toBe(5);
    expect(result.metadata.totalTokensUsed).toBe(15);
    expect(result.metadata.processedAt).toBeDefined();
  });

  it("throws when no JSON found in agent response", async () => {
    const { detectAuthStatus, getApiKey } = await import("./auth-detector.js");
    vi.mocked(detectAuthStatus).mockResolvedValue({
      source: "env_var",
      isConfigured: true,
      claudeCodeInstalled: false,
    });
    vi.mocked(getApiKey).mockResolvedValue("sk-ant-api-key-123");

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    vi.mocked(query).mockReturnValue(
      (async function* () {
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "No JSON here, just text." }],
            usage: { input_tokens: 5, output_tokens: 5 },
          },
        };
        yield {
          type: "result",
          usage: { input_tokens: 5, output_tokens: 5 },
        };
      })() as any,
    );

    const { runAgentQuery } = await import("./ai-service.js");
    const schema = z.object({ result: z.string() });

    await expect(runAgentQuery(schema, { prompt: "test" })).rejects.toThrow(
      "No valid JSON found in agent response",
    );
  });

  it("throws when JSON does not match schema", async () => {
    const { detectAuthStatus, getApiKey } = await import("./auth-detector.js");
    vi.mocked(detectAuthStatus).mockResolvedValue({
      source: "env_var",
      isConfigured: true,
      claudeCodeInstalled: false,
    });
    vi.mocked(getApiKey).mockResolvedValue("sk-ant-api-key-123");

    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    vi.mocked(query).mockReturnValue(
      (async function* () {
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text: '{"wrong_field": 42}' }],
            usage: { input_tokens: 5, output_tokens: 5 },
          },
        };
        yield {
          type: "result",
          usage: { input_tokens: 5, output_tokens: 5 },
        };
      })() as any,
    );

    const { runAgentQuery } = await import("./ai-service.js");
    const schema = z.object({ result: z.string() });

    await expect(runAgentQuery(schema, { prompt: "test" })).rejects.toThrow();
  });
});
