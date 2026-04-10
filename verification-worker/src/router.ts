import { Hono } from "hono";
import type { Env } from "./types";
import { validateBearerToken } from "./lib/auth";
import { verifyRoute } from "./routes/verify";

const WORKER_VERSION = "0.1.0";

const app = new Hono<{ Bindings: Env }>();

// Global error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    { error: { code: "INTERNAL_ERROR", message: err.message } },
    500
  );
});

// Proxy browser requests tagged for a verification container before auth/routes.
app.use("/*", async (c, next) => {
  const verificationId = c.req.header("x-verification-id");
  if (!verificationId) {
    return next();
  }

  const secret = c.env.VERIFICATION_API_SECRET;
  if (!secret) {
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "VERIFICATION_API_SECRET is not configured." } },
      500
    );
  }

  if (c.req.header("x-verification-auth") !== secret) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid verification proxy credentials." } },
      401
    );
  }

  const containerId = c.env.VerificationContainer.idFromName(verificationId);
  const container = c.env.VerificationContainer.get(containerId) as any;
  const headers = new Headers(c.req.raw.headers);
  headers.delete("x-verification-id");
  headers.delete("x-verification-auth");

  const url = new URL(c.req.url);
  const targetUrl = new URL(`${url.pathname}${url.search}`, "http://container");
  const method = c.req.raw.method.toUpperCase();

  return await container.fetch(
    new Request(targetUrl.toString(), {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : c.req.raw.body,
      redirect: "manual",
    })
  );
});

// Health check — no auth
app.get("/health", (c) =>
  c.json({
    ok: true,
    data: {
      status: "ok",
      service: "foundry-verification-worker",
      timestamp: new Date().toISOString(),
      version: WORKER_VERSION,
    },
  })
);

// Bearer token auth for all other routes
app.use("/*", async (c, next) => {
  // Skip auth for health endpoint (already handled above)
  if (c.req.path === "/health") return next();

  const secret = c.env.VERIFICATION_API_SECRET;
  if (!secret) {
    return c.json(
      { error: { code: "INTERNAL_ERROR", message: "VERIFICATION_API_SECRET is not configured." } },
      500
    );
  }

  const valid = await validateBearerToken(c.req.raw, secret);
  if (!valid) {
    return c.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing bearer token." } },
      401
    );
  }

  await next();
});

// Routes
app.route("/verify", verifyRoute);

export { app };
