/**
 * Shared test helpers for agent-worker tests.
 * Mirrors the pattern from sandbox-worker/src/index.test.ts.
 */
import type { Env } from "./types";

const TEST_SECRET = "test-agent-secret";
const TEST_API_KEY = "sk-ant-test-key";

export function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    AGENT_SERVICE_SECRET: TEST_SECRET,
    ANTHROPIC_API_KEY: TEST_API_KEY,
    ...overrides,
  } as Env;
}

export function authedRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  opts: { orgId?: string } = {},
): Request {
  const headers: HeadersInit = {
    Authorization: `Bearer ${TEST_SECRET}`,
    "x-org-id": opts.orgId ?? "org-test-1",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return new Request(`https://agent.example${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function unauthedRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Request {
  const headers: HeadersInit = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return new Request(`https://agent.example${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function readJson(response: Response): Promise<any> {
  return response.json();
}

export { TEST_API_KEY, TEST_SECRET };
