import type { NextFunction, Request, Response } from "express";

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const orgId = req.headers["x-org-id"] as string | undefined;

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[audit] org=${orgId ?? "unknown"} method=${req.method} path=${req.path} status=${res.statusCode} duration=${duration}ms`,
    );
  });

  next();
}
