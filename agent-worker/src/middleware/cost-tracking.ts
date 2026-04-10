import type { MiddlewareHandler } from "hono";

const COST_PER_INPUT_TOKEN = 0.003 / 1000;
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000;

export const costTrackingMiddleware: MiddlewareHandler = async (c, next) => {
  await next();

  // Only track cost on successful JSON responses with metadata
  if (c.res.status === 200) {
    try {
      const body = (await c.res.clone().json()) as Record<string, unknown>;
      const metadata = body?.metadata as Record<string, number> | undefined;
      if (metadata?.totalTokensUsed) {
        const inputTokens = metadata.inputTokens ?? 0;
        const outputTokens = metadata.outputTokens ?? 0;
        const estimatedCost =
          inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
        console.log(
          `[cost] tokens=${metadata.totalTokensUsed} estimated_cost=$${estimatedCost.toFixed(4)}`,
        );
      }
    } catch {
      // Not a JSON response or no metadata — skip cost tracking
    }
  }
};
