import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { codebaseChatRouter } from "./codebase-chat.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/codebase-chat", codebaseChatRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("codebase-chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when question is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/codebase-chat").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_QUESTION");
    expect(response.body.error?.message).toBe("question is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns chat response for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        answer: "The code does X",
        referencedNodeNames: ["index.ts"],
      },
      metadata: {
        totalTokensUsed: 200,
        inputTokens: 120,
        outputTokens: 80,
        processedAt: "2026-03-24T00:00:00Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/codebase-chat")
      .set("x-org-id", "org_test")
      .send({
        question: "What does the main entry point do?",
        graphContext: {
          nodes: [{ name: "index.ts", nodeType: "file" }],
          edges: [],
        },
        chatHistory: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi, how can I help?" },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe("The code does X");
    expect(response.body.referencedNodeNames).toEqual(["index.ts"]);
    expect(response.body.metadata).toEqual(mockResult.metadata);

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
  });

  it("works without graphContext and chatHistory", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockResult = {
      data: {
        answer: "I can help with that",
        referencedNodeNames: [],
      },
      metadata: {
        totalTokensUsed: 100,
        inputTokens: 60,
        outputTokens: 40,
        processedAt: "2026-03-24T00:00:00Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/codebase-chat")
      .set("x-org-id", "org_test")
      .send({ question: "What is this codebase about?" });

    expect(response.status).toBe(200);
    expect(response.body.answer).toBe("I can help with that");
    expect(response.body.referencedNodeNames).toEqual([]);
    expect(response.body.metadata).toBeDefined();

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
  });

  it("handles AI service errors", async () => {
    const app = createTestApp();
    vi.mocked(runAgentQuery).mockRejectedValue(new Error("chat inference failed"));

    const response = await request(app)
      .post("/codebase-chat")
      .set("x-org-id", "org_test")
      .send({ question: "What does this do?" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "chat inference failed" });
  });
});
