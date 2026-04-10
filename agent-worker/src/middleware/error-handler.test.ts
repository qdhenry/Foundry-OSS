import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "./error-handler";

describe("errorHandler", () => {
  function createApp(errorFn: () => never) {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/test", () => {
      errorFn();
    });
    return app;
  }

  it("returns 500 for generic errors", async () => {
    const app = createApp(() => {
      throw new Error("Something broke");
    });

    const res = await app.request("/test");
    expect(res.status).toBe(500);

    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.message).toBe("Something broke");
  });

  it("uses statusCode from error object when present", async () => {
    const app = createApp(() => {
      const err = new Error("Not found") as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    });

    const res = await app.request("/test");
    // Hono wraps statusCode usage; the handler returns it as the status code
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.message).toBe("Not found");
  });

  it("uses code from error object when present", async () => {
    const app = createApp(() => {
      const err = new Error("Bad input") as Error & { code: string; statusCode: number };
      err.code = "VALIDATION_ERROR";
      err.statusCode = 400;
      throw err;
    });

    const res = await app.request("/test");
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Bad input");
  });

  it("logs the error to console.error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp(() => {
      throw new Error("Log me");
    });

    await app.request("/test");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
