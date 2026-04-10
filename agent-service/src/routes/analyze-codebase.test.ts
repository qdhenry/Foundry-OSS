import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgentQuery } from "../lib/ai-service.js";
import { analyzeCodebaseRouter } from "./analyze-codebase.js";

vi.mock("../lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/analyze-codebase", analyzeCodebaseRouter);
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    },
  );
  return app;
}

describe("analyze-codebase route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when repoUrl is missing", async () => {
    const app = createTestApp();

    const response = await request(app).post("/analyze-codebase").send({});

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("MISSING_REPO_URL");
    expect(response.body.error?.message).toBe("repoUrl is required");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid GitHub URL", async () => {
    const app = createTestApp();

    const response = await request(app).post("/analyze-codebase").send({ repoUrl: "not-a-url" });

    expect(response.status).toBe(400);
    expect(response.body.error?.code).toBe("INVALID_REPO_URL");
    expect(response.body.error?.message).toBe("Must be a valid GitHub repository URL");
    expect(runAgentQuery).not.toHaveBeenCalled();
  });

  it("returns analysis result for valid request", async () => {
    const app = createTestApp();
    const mockedRunAgentQuery = vi.mocked(runAgentQuery);

    const mockTreeResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        tree: [{ path: "src/index.ts", type: "blob", size: 500 }],
      }),
    };

    const mockFileResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: btoa("console.log('hello');"),
        encoding: "base64",
      }),
    };

    mockFetch.mockResolvedValueOnce(mockTreeResponse).mockResolvedValueOnce(mockFileResponse);

    const mockResult = {
      data: {
        nodes: [
          {
            nodeType: "file",
            name: "index.ts",
            filePath: "/src/index.ts",
            layer: "api",
            description: "Entry point",
            language: "typescript",
          },
        ],
        edges: [{ sourceIndex: 0, targetIndex: 0, edgeType: "imports" }],
        summary: {
          totalFiles: 1,
          totalFunctions: 0,
          totalClasses: 0,
          languages: ["typescript"],
          frameworks: ["express"],
          layerBreakdown: [{ layer: "api", count: 1 }],
        },
        tours: [
          {
            title: "Getting Started",
            description: "Overview tour",
            steps: [{ nodeIndex: 0, title: "Entry", explanation: "Main entry point", order: 0 }],
          },
        ],
      },
      metadata: {
        totalTokensUsed: 100,
        inputTokens: 50,
        outputTokens: 50,
        processedAt: "2026-03-24T00:00:00Z",
      },
    };

    mockedRunAgentQuery.mockResolvedValue(mockResult);

    const response = await request(app)
      .post("/analyze-codebase")
      .set("x-org-id", "org_test")
      .send({ repoUrl: "https://github.com/test/repo" });

    expect(response.status).toBe(200);
    expect(response.body.analysis.nodes).toHaveLength(1);
    expect(response.body.analysis.nodes[0].nodeType).toBe("file");
    expect(response.body.analysis.edges).toHaveLength(1);
    expect(response.body.analysis.summary.totalFiles).toBe(1);
    expect(response.body.analysis.tours).toHaveLength(1);
    expect(response.body.metadata).toEqual(mockResult.metadata);

    expect(mockedRunAgentQuery).toHaveBeenCalledTimes(1);
  });

  it("handles AI service errors", async () => {
    const app = createTestApp();

    const mockTreeResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        tree: [{ path: "src/index.ts", type: "blob", size: 500 }],
      }),
    };

    const mockFileResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        content: btoa("export default {}"),
        encoding: "base64",
      }),
    };

    mockFetch.mockResolvedValueOnce(mockTreeResponse).mockResolvedValueOnce(mockFileResponse);

    vi.mocked(runAgentQuery).mockRejectedValue(new Error("analysis failed"));

    const response = await request(app)
      .post("/analyze-codebase")
      .set("x-org-id", "org_test")
      .send({ repoUrl: "https://github.com/test/repo" });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: "analysis failed" });
  });
});
