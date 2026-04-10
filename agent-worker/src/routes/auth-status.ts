import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  const hasApiKey = !!c.env.ANTHROPIC_API_KEY;
  return c.json({
    isConfigured: hasApiKey,
    source: hasApiKey ? "environment" : "none",
    checkedAt: new Date().toISOString(),
  });
});

export { app as authStatusRoute };
