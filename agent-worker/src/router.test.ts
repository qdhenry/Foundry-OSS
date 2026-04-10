import { describe, expect, it } from "vitest";
import { app } from "./router";
import { authedRequest, makeEnv, readJson, TEST_SECRET, unauthedRequest } from "./test-helpers";

describe("router", () => {
  const env = makeEnv();

  describe("GET /health", () => {
    it("returns 200 without auth", async () => {
      const req = unauthedRequest("GET", "/health");
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);

      const body = await readJson(res);
      expect(body.ok).toBe(true);
      expect(body.data.status).toBe("ok");
      expect(body.data.service).toBe("foundry-agent-worker");
      expect(body.data.version).toBeTruthy();
    });
  });

  describe("auth middleware", () => {
    it("rejects requests with missing Bearer token with 401", async () => {
      const req = unauthedRequest("GET", "/auth/status");
      const res = await app.fetch(req, env);
      expect(res.status).toBe(401);

      const body = await readJson(res);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects requests with invalid Bearer token with 401", async () => {
      const req = new Request("https://agent.example/auth/status", {
        headers: { Authorization: "Bearer wrong-secret" },
      });
      const res = await app.fetch(req, env);
      expect(res.status).toBe(401);

      const body = await readJson(res);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 500 when AGENT_SERVICE_SECRET is not configured", async () => {
      const envNoSecret = makeEnv({ AGENT_SERVICE_SECRET: "" });
      const req = new Request("https://agent.example/auth/status", {
        headers: { Authorization: `Bearer ${TEST_SECRET}` },
      });
      const res = await app.fetch(req, envNoSecret);
      expect(res.status).toBe(500);

      const body = await readJson(res);
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("authenticated routes", () => {
    it("allows requests with valid Bearer token", async () => {
      const req = authedRequest("GET", "/auth/status");
      const res = await app.fetch(req, env);
      expect(res.status).toBe(200);
    });
  });

  describe("404 handling", () => {
    it("returns 404 for unknown routes", async () => {
      const req = authedRequest("GET", "/nonexistent-route");
      const res = await app.fetch(req, env);
      expect(res.status).toBe(404);
    });
  });
});
