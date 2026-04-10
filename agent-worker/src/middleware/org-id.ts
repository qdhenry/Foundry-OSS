import type { MiddlewareHandler } from "hono";

/**
 * Extracts x-org-id header and makes it available via c.get("orgId").
 * Does not reject requests without it — some routes (health, auth) don't need it.
 */
export const orgIdMiddleware: MiddlewareHandler = async (c, next) => {
  const orgId = c.req.header("x-org-id") ?? "unknown";
  c.set("orgId", orgId);
  await next();
};
