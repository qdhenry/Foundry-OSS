"use node";

import { ConvexError, v } from "convex/values";
import * as generatedApi from "../_generated/api";
import { action } from "../_generated/server";

const apiAny: any = (generatedApi as any).api;
const internalAny: any = (generatedApi as any).internal;

function getWorkerConfig(env: NodeJS.ProcessEnv = process.env) {
  const workerUrl = env.SANDBOX_WORKER_URL?.trim();
  const apiSecret = env.SANDBOX_API_SECRET?.trim();
  if (!workerUrl || !apiSecret) {
    throw new ConvexError(
      "Sandbox worker is not configured. Set SANDBOX_WORKER_URL and SANDBOX_API_SECRET.",
    );
  }
  return { workerUrl, apiSecret };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ConvexError) return String(error.message ?? "Convex error");
  if (error instanceof Error) {
    const message = error.message;
    if (/Route not found:\s+(GET|POST)\s+\/sandbox\/[^/]+\/fs\/(list|read|write)/i.test(message)) {
      return [
        "Sandbox worker does not support file APIs yet.",
        "Deploy or restart sandbox-worker with the latest code (routes /fs/list, /fs/read, /fs/write).",
        "Try: npm --prefix sandbox-worker run deploy",
      ].join(" ");
    }
    return message;
  }
  if (typeof error === "string") return error;
  return "Unknown sandbox file error";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

async function getAuthorizedSession(ctx: any, sessionId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");

  const [user, session] = await Promise.all([
    ctx.runQuery(apiAny.users.getByClerkId, { clerkId: identity.subject }),
    ctx.runQuery(internalAny.sandbox.sessions.getInternal, { sessionId }),
  ]);

  if (!user) throw new ConvexError("Authenticated user not found");
  if (!session) throw new ConvexError("Sandbox session not found");
  if (!user.orgIds.includes(session.orgId)) throw new ConvexError("Access denied");

  return session as {
    _id: string;
    orgId: string;
    sandboxId: string;
  };
}

async function callSandboxWorker(
  options: {
    method: "GET" | "POST";
    path: string;
    query?: Record<string, string | undefined>;
    body?: unknown;
    timeoutMs?: number;
  },
  deps?: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch },
) {
  const { workerUrl, apiSecret } = getWorkerConfig(deps?.env);
  const fetchImpl = deps?.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;

  const base = workerUrl.replace(/\/+$/, "");
  const path = options.path.startsWith("/") ? options.path : `/${options.path}`;
  const url = new URL(`${base}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${apiSecret}`,
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = {};
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    const wrapped = asRecord(parsed);
    if (wrapped && wrapped.ok === true && "data" in wrapped) {
      return wrapped.data;
    }
    if (wrapped && wrapped.ok === false) {
      const errorRecord = asRecord(wrapped.error);
      const message =
        (errorRecord && typeof errorRecord.message === "string"
          ? errorRecord.message
          : typeof wrapped.error === "string"
            ? wrapped.error
            : undefined) ?? `HTTP ${response.status}`;
      throw new Error(message);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ConvexError(
        `Sandbox worker request timed out (${options.method} ${options.path}, ${timeoutMs}ms)`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const list = action({
  args: {
    sessionId: v.id("sandboxSessions"),
    path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await getAuthorizedSession(ctx, args.sessionId);

    try {
      return await callSandboxWorker({
        method: "GET",
        path: `/sandbox/${encodeURIComponent(session.sandboxId)}/fs/list`,
        query: { path: args.path?.trim() || undefined },
      });
    } catch (error) {
      throw new ConvexError(toErrorMessage(error));
    }
  },
});

export const read = action({
  args: {
    sessionId: v.id("sandboxSessions"),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await getAuthorizedSession(ctx, args.sessionId);
    const requestedPath = args.path.trim();
    if (!requestedPath) {
      throw new ConvexError("path is required");
    }

    try {
      return await callSandboxWorker({
        method: "GET",
        path: `/sandbox/${encodeURIComponent(session.sandboxId)}/fs/read`,
        query: { path: requestedPath },
      });
    } catch (error) {
      throw new ConvexError(toErrorMessage(error));
    }
  },
});

export const write = action({
  args: {
    sessionId: v.id("sandboxSessions"),
    path: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await getAuthorizedSession(ctx, args.sessionId);
    const requestedPath = args.path.trim();
    if (!requestedPath) {
      throw new ConvexError("path is required");
    }

    try {
      return await callSandboxWorker({
        method: "POST",
        path: `/sandbox/${encodeURIComponent(session.sandboxId)}/fs/write`,
        body: {
          path: requestedPath,
          content: args.content,
        },
        timeoutMs: 45_000,
      });
    } catch (error) {
      throw new ConvexError(toErrorMessage(error));
    }
  },
});
