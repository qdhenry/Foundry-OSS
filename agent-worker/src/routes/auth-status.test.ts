import { describe, expect, it } from "vitest";
import { app } from "../router";
import { authedRequest, makeEnv, readJson } from "../test-helpers";

const env = makeEnv();

describe("GET /auth/status", () => {
  it("returns isConfigured true when ANTHROPIC_API_KEY is set", async () => {
    const req = authedRequest("GET", "/auth/status");
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.isConfigured).toBe(true);
    expect(body.source).toBe("environment");
    expect(body.checkedAt).toBeTruthy();
  });

  it("returns isConfigured false when ANTHROPIC_API_KEY is empty", async () => {
    const envNoKey = makeEnv({ ANTHROPIC_API_KEY: "" });
    const req = authedRequest("GET", "/auth/status");
    const res = await app.fetch(req, envNoKey);
    expect(res.status).toBe(200);

    const body = await readJson(res);
    expect(body.isConfigured).toBe(false);
    expect(body.source).toBe("none");
  });
});
