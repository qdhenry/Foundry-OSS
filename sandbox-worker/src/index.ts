export { Sandbox } from "@cloudflare/sandbox";
export { SessionStore } from "./session-store";

import type { ApiError, ApiResponse } from "@foundry/types";
import type { Env, WorkerExecutionContext } from "./types";
import { nowIso, validateTerminalToken } from "./utils";

const WORKER_VERSION = "0.2.0";

const JSON_HEADERS: HeadersInit = {
  "content-type": "application/json; charset=utf-8",
};

export default {
  async fetch(request: Request, env: Env, _ctx: WorkerExecutionContext): Promise<Response> {
    try {
      return await routeRequest(request, env);
    } catch (error) {
      return json(500, {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Unhandled sandbox worker error.",
          details: { reason: errorToMessage(error) },
        },
      });
    }
  },
};

async function routeRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);
  const method = request.method.toUpperCase();

  // Health check — no auth, no DO
  if (method === "GET" && path === "/health") {
    return json(200, {
      ok: true,
      data: {
        status: "ok",
        service: "sandbox-worker",
        timestamp: nowIso(),
        version: WORKER_VERSION,
      },
    });
  }

  // Terminal WebSocket — uses HMAC token auth instead of bearer token
  // (browsers can't set Authorization headers on WebSocket connections)
  const terminalMatch = path.match(/^\/sandbox\/([^/]+)\/terminal$/);
  if (terminalMatch && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
    const sandboxId = decodeURIComponent(terminalMatch[1]);
    const secret = env.SANDBOX_API_SECRET?.trim();
    if (!secret) {
      return json(500, {
        ok: false,
        error: { code: "INTERNAL_ERROR", message: "SANDBOX_API_SECRET is not configured." },
      });
    }
    const token = new URL(request.url).searchParams.get("token");
    if (!token)
      return json(401, {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Terminal token required." },
      });
    const valid = await validateTerminalToken(token, sandboxId, secret);
    if (!valid)
      return json(401, {
        ok: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired terminal token." },
      });
    const stub = getSessionStub(env, sandboxId);
    return stub.fetch(rewriteUrl(request, "/terminal"));
  }

  // Auth gate for all sandbox routes
  const authError = await authorize(request, env);
  if (authError) {
    return json(authError.status, { ok: false, error: authError.error });
  }

  // POST /sandbox/create → SessionStore DO
  if (method === "POST" && path === "/sandbox/create") {
    const body = (await request
      .clone()
      .json()
      .catch(() => ({}))) as Record<string, unknown>;
    const rawId = typeof body.sandboxId === "string" ? body.sandboxId.trim() : "";
    const sandboxId = rawId || crypto.randomUUID();
    const stub = getSessionStub(env, sandboxId);
    return stub.fetch(rewriteUrl(request, "/create"));
  }

  // Route /sandbox/:id/* → SessionStore DO
  const sandboxMatch = path.match(/^\/sandbox\/([^/]+)(?:\/(.+))?$/);
  if (sandboxMatch) {
    const sandboxId = decodeURIComponent(sandboxMatch[1]);
    const action = sandboxMatch[2] || "";
    const stub = getSessionStub(env, sandboxId);

    switch (action) {
      case "execute":
        if (method === "POST") return stub.fetch(rewriteUrl(request, "/execute"));
        break;
      case "logs":
        if (method === "GET") return stub.fetch(rewriteUrl(request, "/logs"));
        break;
      case "fs/list":
        if (method === "GET") return stub.fetch(rewriteUrl(request, "/fs/list"));
        break;
      case "fs/read":
        if (method === "GET") return stub.fetch(rewriteUrl(request, "/fs/read"));
        break;
      case "fs/write":
        if (method === "POST") return stub.fetch(rewriteUrl(request, "/fs/write"));
        break;
      case "finalize":
        if (method === "POST") return stub.fetch(rewriteUrl(request, "/finalize"));
        break;
      case "message":
        if (method === "POST") return stub.fetch(rewriteUrl(request, "/message"));
        break;
      case "":
        if (method === "DELETE") return stub.fetch(rewriteUrl(request, "/delete"));
        break;
    }
  }

  return json(404, {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${method} ${path}`,
    },
  });
}

function getSessionStub(env: Env, sandboxId: string) {
  const id = env.SessionStore.idFromName(sandboxId);
  return env.SessionStore.get(id);
}

function rewriteUrl(request: Request, newPath: string): Request {
  const url = new URL(request.url);
  url.pathname = newPath;
  return new Request(url.toString(), request);
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function json<T>(status: number, payload: ApiResponse<T>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

async function authorize(
  request: Request,
  env: Env,
): Promise<{ status: number; error: ApiError } | null> {
  const secret = env.SANDBOX_API_SECRET?.trim();
  if (!secret) {
    return {
      status: 500,
      error: {
        code: "INTERNAL_ERROR",
        message: "SANDBOX_API_SECRET is not configured.",
      },
    };
  }

  const header = request.headers.get("authorization");
  if (!header) {
    return unauthorized();
  }

  const [scheme, ...tokenParts] = header.trim().split(/\s+/);
  if (scheme.toLowerCase() !== "bearer" || tokenParts.length === 0) {
    return unauthorized();
  }

  const token = tokenParts.join(" ").trim();
  if (!(await timingSafeEqual(token, secret))) {
    return unauthorized();
  }

  return null;
}

function unauthorized(): { status: number; error: ApiError } {
  return {
    status: 401,
    error: {
      code: "UNAUTHORIZED",
      message: "Invalid or missing bearer token.",
    },
  };
}

async function timingSafeEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const providedBytes = new Uint8Array(providedHash);
  const expectedBytes = new Uint8Array(expectedHash);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < providedBytes.length; index += 1) {
    diff |= providedBytes[index] ^ expectedBytes[index];
  }
  return diff === 0;
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "Unknown error";
}
