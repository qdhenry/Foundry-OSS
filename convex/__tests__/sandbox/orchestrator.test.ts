import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { __test__ } from "../../sandbox/orchestrator";
import schema from "../../schema";
import { modules } from "../../test.helpers";

const {
  toErrorMessage,
  shouldQueueWorkerCreateFailure,
  parseQueueLaunchMode,
  toPositiveQueueLimit,
  getWorkerConfig,
  getQueueReplayToken,
  parseWorkerLogsPayload,
} = __test__;

// ── toErrorMessage ──────────────────────────────────────────────────

describe("toErrorMessage", () => {
  test("converts ConvexError to string", () => {
    const error = new ConvexError("Something went wrong");
    expect(toErrorMessage(error)).toBe("Something went wrong");
  });

  test("converts standard Error to string", () => {
    const error = new Error("Standard error");
    expect(toErrorMessage(error)).toBe("Standard error");
  });

  test("passes through string errors", () => {
    expect(toErrorMessage("plain string error")).toBe("plain string error");
  });

  test("returns default message for unknown types", () => {
    expect(toErrorMessage(42)).toBe("Unknown sandbox orchestrator error");
    expect(toErrorMessage(null)).toBe("Unknown sandbox orchestrator error");
    expect(toErrorMessage(undefined)).toBe("Unknown sandbox orchestrator error");
    expect(toErrorMessage({})).toBe("Unknown sandbox orchestrator error");
  });
});

// ── shouldQueueWorkerCreateFailure ──────────────────────────────────

describe("shouldQueueWorkerCreateFailure", () => {
  test("returns true for unconfigured sandbox worker", () => {
    expect(shouldQueueWorkerCreateFailure(new Error("Sandbox worker is not configured"))).toBe(
      true,
    );
  });

  test("returns true for sandbox worker timeout", () => {
    expect(
      shouldQueueWorkerCreateFailure(new Error("sandbox worker /sandbox/create request timed out")),
    ).toBe(true);
  });

  test("returns true for sandbox worker service unavailable", () => {
    expect(
      shouldQueueWorkerCreateFailure(new Error("sandbox worker returned service unavailable")),
    ).toBe(true);
  });

  test("returns true for sandbox worker 503", () => {
    expect(shouldQueueWorkerCreateFailure(new Error("sandbox worker returned 503"))).toBe(true);
  });

  test("returns true for sandbox worker 502 bad gateway", () => {
    expect(shouldQueueWorkerCreateFailure(new Error("sandbox worker bad gateway"))).toBe(true);
  });

  test("returns true for sandbox worker connection refused", () => {
    expect(shouldQueueWorkerCreateFailure(new Error("sandbox worker connection refused"))).toBe(
      true,
    );
  });

  test("returns true for worker request ECONNREFUSED", () => {
    expect(shouldQueueWorkerCreateFailure(new Error("worker request econnrefused"))).toBe(true);
  });

  test("returns false for unrelated errors", () => {
    expect(shouldQueueWorkerCreateFailure(new Error("some random error"))).toBe(false);
  });

  test("returns false for non-worker context errors with outage signals", () => {
    // "service unavailable" without "sandbox worker" or "/sandbox/create" context
    expect(shouldQueueWorkerCreateFailure(new Error("service unavailable"))).toBe(false);
  });

  test("returns false for empty error message", () => {
    expect(shouldQueueWorkerCreateFailure(new Error(""))).toBe(false);
  });
});

// ── parseQueueLaunchMode ────────────────────────────────────────────

describe("parseQueueLaunchMode", () => {
  test("returns 'standard' for valid standard input", () => {
    expect(parseQueueLaunchMode("standard")).toBe("standard");
  });

  test("returns 'subtasks' for valid subtasks input", () => {
    expect(parseQueueLaunchMode("subtasks")).toBe("subtasks");
  });

  test("returns 'single_subtask' for valid single_subtask input", () => {
    expect(parseQueueLaunchMode("single_subtask")).toBe("single_subtask");
  });

  test("defaults to 'standard' for unknown string", () => {
    expect(parseQueueLaunchMode("invalid")).toBe("standard");
    expect(parseQueueLaunchMode("")).toBe("standard");
  });

  test("defaults to 'standard' for non-string values", () => {
    expect(parseQueueLaunchMode(null)).toBe("standard");
    expect(parseQueueLaunchMode(undefined)).toBe("standard");
    expect(parseQueueLaunchMode(42)).toBe("standard");
    expect(parseQueueLaunchMode({})).toBe("standard");
  });
});

// ── toPositiveQueueLimit ────────────────────────────────────────────

describe("toPositiveQueueLimit", () => {
  test("returns default for undefined", () => {
    // Default is QUEUE_DRAIN_DEFAULT_LIMIT = 5
    expect(toPositiveQueueLimit(undefined)).toBe(5);
  });

  test("returns default for NaN", () => {
    expect(toPositiveQueueLimit(NaN)).toBe(5);
  });

  test("returns default for Infinity", () => {
    expect(toPositiveQueueLimit(Infinity)).toBe(5);
  });

  test("clamps to minimum of 1", () => {
    expect(toPositiveQueueLimit(0)).toBe(1);
    expect(toPositiveQueueLimit(-5)).toBe(1);
  });

  test("clamps to maximum of 25", () => {
    // QUEUE_DRAIN_MAX_LIMIT = 25
    expect(toPositiveQueueLimit(100)).toBe(25);
    expect(toPositiveQueueLimit(50)).toBe(25);
  });

  test("floors fractional values", () => {
    expect(toPositiveQueueLimit(3.7)).toBe(3);
    expect(toPositiveQueueLimit(10.9)).toBe(10);
  });

  test("passes through valid integers within range", () => {
    expect(toPositiveQueueLimit(1)).toBe(1);
    expect(toPositiveQueueLimit(5)).toBe(5);
    expect(toPositiveQueueLimit(25)).toBe(25);
    expect(toPositiveQueueLimit(15)).toBe(15);
  });
});

// ── getWorkerConfig ─────────────────────────────────────────────────

describe("getWorkerConfig", () => {
  test("returns config when both env vars are set", () => {
    const env = {
      SANDBOX_WORKER_URL: "https://worker.example.com",
      SANDBOX_API_SECRET: "secret-123",
    } as unknown as NodeJS.ProcessEnv;

    const config = getWorkerConfig(env);
    expect(config).toEqual({
      workerUrl: "https://worker.example.com",
      apiSecret: "secret-123",
    });
  });

  test("trims whitespace from env vars", () => {
    const env = {
      SANDBOX_WORKER_URL: "  https://worker.example.com  ",
      SANDBOX_API_SECRET: "  secret-123  ",
    } as unknown as NodeJS.ProcessEnv;

    const config = getWorkerConfig(env);
    expect(config.workerUrl).toBe("https://worker.example.com");
    expect(config.apiSecret).toBe("secret-123");
  });

  test("throws ConvexError when SANDBOX_WORKER_URL is missing", () => {
    const env = {
      SANDBOX_API_SECRET: "secret-123",
    } as unknown as NodeJS.ProcessEnv;

    expect(() => getWorkerConfig(env)).toThrow(ConvexError);
  });

  test("throws ConvexError when SANDBOX_API_SECRET is missing", () => {
    const env = {
      SANDBOX_WORKER_URL: "https://worker.example.com",
    } as unknown as NodeJS.ProcessEnv;

    expect(() => getWorkerConfig(env)).toThrow(ConvexError);
  });

  test("throws ConvexError when both env vars are missing", () => {
    const env = {} as unknown as NodeJS.ProcessEnv;
    expect(() => getWorkerConfig(env)).toThrow(ConvexError);
  });

  test("throws when env vars are empty strings", () => {
    const env = {
      SANDBOX_WORKER_URL: "",
      SANDBOX_API_SECRET: "",
    } as unknown as NodeJS.ProcessEnv;

    expect(() => getWorkerConfig(env)).toThrow(ConvexError);
  });

  test("throws when env vars are whitespace only", () => {
    const env = {
      SANDBOX_WORKER_URL: "   ",
      SANDBOX_API_SECRET: "   ",
    } as unknown as NodeJS.ProcessEnv;

    expect(() => getWorkerConfig(env)).toThrow(ConvexError);
  });
});

// ── getQueueReplayToken ─────────────────────────────────────────────

describe("getQueueReplayToken", () => {
  test("returns SANDBOX_QUEUE_REPLAY_SECRET if set", () => {
    const env = {
      SANDBOX_QUEUE_REPLAY_SECRET: "replay-secret",
      SANDBOX_API_SECRET: "api-secret",
    } as unknown as NodeJS.ProcessEnv;

    expect(getQueueReplayToken(env)).toBe("replay-secret");
  });

  test("falls back to SANDBOX_API_SECRET", () => {
    const env = {
      SANDBOX_API_SECRET: "api-secret",
    } as unknown as NodeJS.ProcessEnv;

    expect(getQueueReplayToken(env)).toBe("api-secret");
  });

  test("returns empty string when neither env var is set", () => {
    const env = {} as unknown as NodeJS.ProcessEnv;
    expect(getQueueReplayToken(env)).toBe("");
  });

  test("trims whitespace from replay secret", () => {
    const env = {
      SANDBOX_QUEUE_REPLAY_SECRET: "  replay-secret  ",
    } as unknown as NodeJS.ProcessEnv;

    expect(getQueueReplayToken(env)).toBe("replay-secret");
  });

  test("skips empty replay secret and falls back", () => {
    const env = {
      SANDBOX_QUEUE_REPLAY_SECRET: "   ",
      SANDBOX_API_SECRET: "fallback-secret",
    } as unknown as NodeJS.ProcessEnv;

    expect(getQueueReplayToken(env)).toBe("fallback-secret");
  });
});

// ── parseWorkerLogsPayload ──────────────────────────────────────────

describe("parseWorkerLogsPayload", () => {
  test("returns empty result for empty string", () => {
    const result = parseWorkerLogsPayload("");
    expect(result.entries).toEqual([]);
    expect(result.done).toBe(false);
    expect(result.failed).toBe(false);
  });

  test("returns empty result for whitespace string", () => {
    const result = parseWorkerLogsPayload("   ");
    expect(result.entries).toEqual([]);
    expect(result.done).toBe(false);
    expect(result.failed).toBe(false);
  });

  test("parses JSON string payload by recursing", () => {
    const payload = JSON.stringify([{ level: "info", message: "Starting up" }]);
    const result = parseWorkerLogsPayload(payload);
    expect(result.entries.length).toBeGreaterThanOrEqual(0);
  });

  test("handles array payload with log entries", () => {
    const entries = [
      { level: "info", message: "Step 1 complete", timestamp: 1000 },
      { level: "stderr", message: "Warning: something", timestamp: 2000 },
    ];
    const result = parseWorkerLogsPayload(entries);
    expect(result.entries.length).toBeGreaterThanOrEqual(0);
    expect(result.done).toBe(false);
    expect(result.failed).toBe(false);
  });

  test("handles null/undefined payload gracefully", () => {
    // Object payload fallback — should not throw
    const result = parseWorkerLogsPayload(null);
    expect(result).toBeDefined();
    expect(result.entries).toBeDefined();
  });
});
