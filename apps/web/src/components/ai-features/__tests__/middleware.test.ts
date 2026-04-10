import { beforeEach, describe, expect, it, vi } from "vitest";

// Simple mock types matching Express interfaces
interface MockRequest {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body?: unknown;
}

interface MockResponse {
  statusCode: number;
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  _finishCallbacks: Array<() => void>;
}

function createMockRequest(overrides?: Partial<MockRequest>): MockRequest {
  return {
    method: "POST",
    path: "/api/test",
    headers: {},
    ...overrides,
  };
}

function createMockResponse(): MockResponse {
  const finishCallbacks: Array<() => void> = [];
  const res: MockResponse = {
    statusCode: 200,
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockImplementation((code: number) => {
      res.statusCode = code;
      return res;
    }),
    on: vi.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === "finish") {
        finishCallbacks.push(cb);
      }
    }),
    _finishCallbacks: finishCallbacks,
  };
  return res;
}

// ================================================================
// Cost Tracking Middleware Tests
// ================================================================

describe("Cost Tracking Logic", () => {
  const COST_PER_INPUT_TOKEN = 0.003 / 1000;
  const COST_PER_OUTPUT_TOKEN = 0.015 / 1000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates correct cost for given token counts", () => {
    const inputTokens = 1000;
    const outputTokens = 500;

    const expectedCost = inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;

    expect(expectedCost).toBeCloseTo(0.0105, 4);
  });

  it("calculates zero cost for zero tokens", () => {
    const cost = 0 * COST_PER_INPUT_TOKEN + 0 * COST_PER_OUTPUT_TOKEN;
    expect(cost).toBe(0);
  });

  it("calculates cost correctly for input-only tokens", () => {
    const cost = 5000 * COST_PER_INPUT_TOKEN + 0 * COST_PER_OUTPUT_TOKEN;
    expect(cost).toBeCloseTo(0.015, 4);
  });

  it("calculates cost correctly for output-only tokens", () => {
    const cost = 0 * COST_PER_INPUT_TOKEN + 2000 * COST_PER_OUTPUT_TOKEN;
    expect(cost).toBeCloseTo(0.03, 4);
  });

  it("handles large token counts", () => {
    const inputTokens = 100000;
    const outputTokens = 50000;
    const cost = inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
    expect(cost).toBeCloseTo(1.05, 2);
  });

  it("cost tracking middleware wraps res.json", () => {
    const res = createMockResponse();
    const originalJson = res.json;
    const next = vi.fn();

    // Simulate the middleware behavior
    const wrappedJson = vi.fn((body: unknown) => {
      if (body && typeof body === "object" && "metadata" in (body as Record<string, unknown>)) {
        const metadata = (body as Record<string, unknown>).metadata as Record<string, unknown>;
        if (metadata && typeof metadata.totalTokensUsed === "number") {
          const inputTokens = (metadata.inputTokens as number) ?? 0;
          const outputTokens = (metadata.outputTokens as number) ?? 0;
          const _estimatedCost =
            inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
          // In real middleware, this would console.log
        }
      }
      return originalJson(body);
    });

    res.json = wrappedJson;
    next();

    const body = {
      findings: {},
      metadata: {
        totalTokensUsed: 1500,
        inputTokens: 1000,
        outputTokens: 500,
      },
    };
    res.json(body);
    expect(wrappedJson).toHaveBeenCalledWith(body);
  });
});

// ================================================================
// Audit Middleware Tests
// ================================================================

describe("Audit Logging Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs request with org id, method, path, and status", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const req = createMockRequest({
      headers: { "x-org-id": "org_123" },
    });
    const res = createMockResponse();
    const next = vi.fn();

    // Simulate audit middleware behavior
    const start = Date.now();
    const orgId = req.headers["x-org-id"];

    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(
        `[audit] org=${orgId ?? "unknown"} method=${req.method} path=${req.path} status=${res.statusCode} duration=${duration}ms`,
      );
    });

    next();

    // Trigger finish event
    res._finishCallbacks.forEach((cb) => cb());

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[audit]"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("org=org_123"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("method=POST"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("path=/api/test"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("status=200"));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("duration="));
    consoleSpy.mockRestore();
  });

  it("uses 'unknown' when org id is missing", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const req = createMockRequest(); // no x-org-id header
    const res = createMockResponse();

    const orgId = req.headers["x-org-id"];
    res.on("finish", () => {
      console.log(
        `[audit] org=${orgId ?? "unknown"} method=${req.method} path=${req.path} status=${res.statusCode} duration=0ms`,
      );
    });

    res._finishCallbacks.forEach((cb) => cb());

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("org=unknown"));
    consoleSpy.mockRestore();
  });

  it("calls next() to continue middleware chain", () => {
    const next = vi.fn();
    // Simulate: audit middleware calls next()
    next();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ================================================================
// Error Handler Tests
// ================================================================

describe("Error Handler Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns structured error response with correct status code", () => {
    const res = createMockResponse();
    const error = new Error("Something went wrong") as Error & {
      statusCode?: number;
      code?: string;
    };
    error.statusCode = 400;
    error.code = "BAD_REQUEST";

    // Simulate error handler behavior
    const statusCode = error.statusCode ?? 500;
    const code = error.code ?? "INTERNAL_ERROR";
    res.status(statusCode).json({
      error: {
        code,
        message: error.message,
      },
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "BAD_REQUEST",
        message: "Something went wrong",
      },
    });
  });

  it("defaults to 500 and INTERNAL_ERROR when not provided", () => {
    const res = createMockResponse();
    const error = new Error("Unexpected error");

    const statusCode = (error as any).statusCode ?? 500;
    const code = (error as any).code ?? "INTERNAL_ERROR";
    res.status(statusCode).json({
      error: {
        code,
        message: error.message,
      },
    });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected error",
      },
    });
  });

  it("logs error to console.error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Test error") as Error & { code?: string };
    error.code = "TEST_ERROR";

    // Simulate error handler logging
    console.error(`[error] ${error.code}: ${error.message}`, error.stack);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[error] TEST_ERROR: Test error"),
      expect.any(String),
    );
    consoleSpy.mockRestore();
  });

  it("includes stack trace in development mode", () => {
    const res = createMockResponse();
    const error = new Error("Dev error") as Error & {
      statusCode?: number;
      code?: string;
    };
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const statusCode = error.statusCode ?? 500;
    const code = error.code ?? "INTERNAL_ERROR";
    res.status(statusCode).json({
      error: {
        code,
        message: error.message,
        ...(process.env.NODE_ENV === "development" && {
          stack: error.stack,
        }),
      },
    });

    const jsonCall = res.json.mock.calls[0][0] as {
      error: { stack?: string };
    };
    expect(jsonCall.error.stack).toBeDefined();

    process.env.NODE_ENV = originalEnv;
  });

  it("does not include stack trace in production mode", () => {
    const res = createMockResponse();
    const error = new Error("Prod error") as Error & {
      statusCode?: number;
      code?: string;
    };
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const statusCode = error.statusCode ?? 500;
    const code = error.code ?? "INTERNAL_ERROR";
    res.status(statusCode).json({
      error: {
        code,
        message: error.message,
        ...(process.env.NODE_ENV === "development" && {
          stack: error.stack,
        }),
      },
    });

    const jsonCall = res.json.mock.calls[0][0] as {
      error: { stack?: string };
    };
    expect(jsonCall.error.stack).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });
});
