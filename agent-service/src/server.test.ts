import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// Mock auth-detector to avoid file system access
vi.mock("./lib/auth-detector.js", () => ({
  detectAuthStatus: vi.fn().mockResolvedValue({
    source: "none",
    isConfigured: false,
    claudeCodeInstalled: false,
  }),
  getApiKey: vi.fn().mockResolvedValue(null),
  setApiKey: vi.fn().mockResolvedValue(undefined),
  clearApiKey: vi.fn().mockResolvedValue(undefined),
}));

// Mock ai-service to avoid real SDK calls
vi.mock("./lib/ai-service.js", () => ({
  runAgentQuery: vi.fn(),
}));

describe("server", () => {
  it("health endpoint returns ok", async () => {
    const { app } = await import("./server.js");

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.timestamp).toBeDefined();
  });

  it("GET /auth/status returns auth status", async () => {
    const { app } = await import("./server.js");

    const response = await request(app).get("/auth/status");

    expect(response.status).toBe(200);
    expect(response.body.source).toBe("none");
    expect(response.body.isConfigured).toBe(false);
  });

  it("POST /auth/api-key returns 400 for missing apiKey", async () => {
    const { app } = await import("./server.js");

    const response = await request(app).post("/auth/api-key").send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("apiKey is required");
  });

  it("POST /auth/api-key returns 400 for invalid key format", async () => {
    const { app } = await import("./server.js");

    const response = await request(app).post("/auth/api-key").send({ apiKey: "invalid-key" });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Invalid API key format");
  });

  it("POST /auth/api-key accepts valid key", async () => {
    const { app } = await import("./server.js");

    const response = await request(app)
      .post("/auth/api-key")
      .send({ apiKey: "sk-ant-valid-key-123" });

    expect(response.status).toBe(200);
  });

  it("DELETE /auth/api-key clears the key", async () => {
    const { app } = await import("./server.js");

    const response = await request(app).delete("/auth/api-key");

    expect(response.status).toBe(200);
  });

  it("returns 404 for unknown routes", async () => {
    const { app } = await import("./server.js");

    const response = await request(app).get("/nonexistent-route");

    expect(response.status).toBe(404);
  });
});
