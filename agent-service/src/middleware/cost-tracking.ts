import type { NextFunction, Request, Response } from "express";

const COST_PER_INPUT_TOKEN = 0.003 / 1000;
const COST_PER_OUTPUT_TOKEN = 0.015 / 1000;

export function costTrackingMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    if (body && typeof body === "object" && "metadata" in (body as Record<string, unknown>)) {
      const metadata = (body as Record<string, unknown>).metadata as
        | Record<string, unknown>
        | undefined;
      if (metadata && typeof metadata.totalTokensUsed === "number") {
        const inputTokens = (metadata.inputTokens as number) ?? 0;
        const outputTokens = (metadata.outputTokens as number) ?? 0;
        const estimatedCost =
          inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
        console.log(
          `[cost] tokens=${metadata.totalTokensUsed} estimated_cost=$${estimatedCost.toFixed(4)}`,
        );
      }
    }
    return originalJson(body);
  };

  next();
}
