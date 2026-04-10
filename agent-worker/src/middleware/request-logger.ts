import type { MiddlewareHandler } from "hono";

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${c.req.method} ${c.req.path}`);
  await next();
};
