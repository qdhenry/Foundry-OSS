import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  const statusCode = "statusCode" in err ? (err as { statusCode: number }).statusCode : 500;
  const code = "code" in err ? (err as { code: string }).code : "INTERNAL_ERROR";

  console.error(`[error] ${code}: ${err.message}`, err.stack);

  return c.json(
    {
      error: {
        code,
        message: err.message,
      },
    },
    statusCode as 500,
  );
};
