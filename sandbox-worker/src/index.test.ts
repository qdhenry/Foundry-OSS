// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

// Mock modules that require Cloudflare runtime before importing worker
vi.mock("@cloudflare/sandbox", () => ({ Sandbox: class {} }));
vi.mock("./session-store", () => ({ SessionStore: class {} }));

import worker from "./index";
import type { Env, WorkerExecutionContext } from "./types";

const TEST_SECRET = "sandbox-secret";

function makeEnv(): Env {
  return {
    SANDBOX_API_SECRET: TEST_SECRET,
    SessionStore: {} as Env["SessionStore"],
  };
}

function makeEnvWithStub(onFetch: (request: Request) => Response | Promise<Response>): Env {
  const stub = {
    fetch: onFetch,
  };

  return {
    SANDBOX_API_SECRET: TEST_SECRET,
    SessionStore: {
      idFromName: (_name: string) => "test-id" as unknown as DurableObjectId,
      get: (_id: DurableObjectId) => stub as unknown as DurableObjectStub,
    } as unknown as Env["SessionStore"],
  };
}

function makeCtx(): WorkerExecutionContext {
  return {
    waitUntil: (_promise: Promise<unknown>) => {
      // No-op in tests.
    },
  };
}

function makeRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  auth: "valid" | "missing" | "invalid" = "valid",
): Request {
  const headers: HeadersInit = {};
  if (auth === "valid") {
    headers.Authorization = `Bearer ${TEST_SECRET}`;
  } else if (auth === "invalid") {
    headers.Authorization = "Bearer wrong";
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return new Request(`https://sandbox.example${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function readJson(response: Response): Promise<any> {
  return await response.json();
}

describe("sandbox-worker routes", () => {
  it("returns health without auth", async () => {
    const response = await worker.fetch(
      makeRequest("GET", "/health", undefined, "missing"),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("sandbox-worker");
  });

  it("rejects unauthorized sandbox requests", async () => {
    const response = await worker.fetch(
      makeRequest(
        "POST",
        "/sandbox/create",
        {
          repoUrl: "acme/storefront",
          branch: "main",
          worktreeBranch: "agent/task-1",
        },
        "missing",
      ),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(401);
    const body = await readJson(response);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects requests with invalid token", async () => {
    const response = await worker.fetch(
      makeRequest(
        "POST",
        "/sandbox/create",
        {
          repoUrl: "acme/storefront",
          branch: "main",
          worktreeBranch: "agent/task-1",
        },
        "invalid",
      ),
      makeEnv(),
      makeCtx(),
    );

    expect(response.status).toBe(401);
    const body = await readJson(response);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 for unknown routes", async () => {
    const response = await worker.fetch(makeRequest("GET", "/unknown-route"), makeEnv(), makeCtx());

    expect(response.status).toBe(404);
    const body = await readJson(response);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("routes nested fs/list path to SessionStore /fs/list", async () => {
    const response = await worker.fetch(
      makeRequest("GET", "/sandbox/sbx-1/fs/list?path=src"),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(
          JSON.stringify({
            ok: true,
            data: { pathname: url.pathname, search: url.search },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.ok).toBe(true);
    expect(body.data.pathname).toBe("/fs/list");
    expect(body.data.search).toBe("?path=src");
  });

  it("routes POST /sandbox/create to SessionStore /create", async () => {
    const response = await worker.fetch(
      makeRequest("POST", "/sandbox/create", {
        sandboxId: "sbx-custom",
        repoUrl: "acme/storefront",
        branch: "main",
        worktreeBranch: "agent/task-1",
      }),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify({ ok: true, data: { pathname: url.pathname } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.ok).toBe(true);
    expect(body.data.pathname).toBe("/create");
  });

  it("routes POST /sandbox/:id/execute to SessionStore /execute", async () => {
    const response = await worker.fetch(
      makeRequest("POST", "/sandbox/sbx-1/execute", { taskPrompt: "do stuff" }),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify({ ok: true, data: { pathname: url.pathname } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.pathname).toBe("/execute");
  });

  it("routes GET /sandbox/:id/logs to SessionStore /logs", async () => {
    const response = await worker.fetch(
      makeRequest("GET", "/sandbox/sbx-1/logs"),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify({ ok: true, data: { pathname: url.pathname } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.pathname).toBe("/logs");
  });

  it("routes DELETE /sandbox/:id to SessionStore /delete", async () => {
    const response = await worker.fetch(
      makeRequest("DELETE", "/sandbox/sbx-1"),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify({ ok: true, data: { pathname: url.pathname } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.pathname).toBe("/delete");
  });

  it("routes POST /sandbox/:id/finalize to SessionStore /finalize", async () => {
    const response = await worker.fetch(
      makeRequest("POST", "/sandbox/sbx-1/finalize", {}),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify({ ok: true, data: { pathname: url.pathname } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.pathname).toBe("/finalize");
  });

  it("routes POST /sandbox/:id/message to SessionStore /message", async () => {
    const response = await worker.fetch(
      makeRequest("POST", "/sandbox/sbx-1/message", { content: "hello" }),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify({ ok: true, data: { pathname: url.pathname } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.pathname).toBe("/message");
  });

  it("routes GET /sandbox/:id/fs/read to SessionStore /fs/read", async () => {
    const response = await worker.fetch(
      makeRequest("GET", "/sandbox/sbx-1/fs/read?path=index.ts"),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(
          JSON.stringify({ ok: true, data: { pathname: url.pathname, search: url.search } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.pathname).toBe("/fs/read");
    expect(body.data.search).toBe("?path=index.ts");
  });

  it("routes POST /sandbox/:id/fs/write to SessionStore /fs/write", async () => {
    const response = await worker.fetch(
      makeRequest("POST", "/sandbox/sbx-1/fs/write", { path: "test.ts", content: "code" }),
      makeEnvWithStub((request) => {
        const url = new URL(request.url);
        return new Response(JSON.stringify({ ok: true, data: { pathname: url.pathname } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.pathname).toBe("/fs/write");
  });

  it("returns 404 for wrong method on known route", async () => {
    // GET on /sandbox/:id/execute should 404 (expects POST)
    // We need a stub since getSessionStub is called before the method check
    const response = await worker.fetch(
      makeRequest("GET", "/sandbox/sbx-1/execute"),
      makeEnvWithStub(() => {
        return new Response("should not be called", { status: 500 });
      }),
      makeCtx(),
    );

    expect(response.status).toBe(404);
    const body = await readJson(response);
    expect(body.ok).toBe(false);
  });

  it("normalizes trailing slash", async () => {
    const response = await worker.fetch(makeRequest("GET", "/health/"), makeEnv(), makeCtx());

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body.data.status).toBe("ok");
  });

  // Note: sandbox terminal WebSocket tests require the Cloudflare Workers
  // runtime with Durable Object support and WebSocket upgrade handling.
  // These are integration tests run via `wrangler test` or `wrangler dev`.
});
