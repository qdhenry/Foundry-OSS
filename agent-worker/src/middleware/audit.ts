import type { MiddlewareHandler } from "hono";

export const auditMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const orgId = c.req.header("x-org-id") ?? "unknown";

  await next();

  const duration = Date.now() - start;
  console.log(
    `[audit] org=${orgId} method=${c.req.method} path=${c.req.path} status=${c.res.status} duration=${duration}ms`,
  );
};
