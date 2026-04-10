import { describe, expect, it, vi } from "vitest";
import type { RetryConfig } from "../types";
import { RetryEngine } from "./RetryEngine";

function fastConfig(overrides?: Partial<RetryConfig>): RetryConfig {
  return {
    maxRetries: 2,
    baseDelayMs: 10,
    maxDelayMs: 50,
    backoffMultiplier: 2,
    jitter: false,
    ...overrides,
  };
}

describe("RetryEngine", () => {
  it("succeeds on first try without retrying", async () => {
    const engine = new RetryEngine();
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await engine.execute("convex", "test-op", fn, fastConfig());
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const engine = new RetryEngine();
    const fn = vi.fn().mockRejectedValueOnce(new Error("fail1")).mockResolvedValue("ok");
    const result = await engine.execute("convex", "test-op", fn, fastConfig());
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const engine = new RetryEngine();
    const fn = vi.fn().mockRejectedValue(new Error("always-fail"));
    await expect(
      engine.execute("convex", "test-op", fn, fastConfig({ maxRetries: 1 })),
    ).rejects.toThrow("always-fail");
    expect(fn).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("getActiveRetries returns empty when idle", () => {
    const engine = new RetryEngine();
    expect(engine.getActiveRetries()).toEqual([]);
  });

  it("emits events to subscribers", async () => {
    const engine = new RetryEngine();
    const listener = vi.fn();
    engine.subscribe(listener);
    const fn = vi.fn().mockResolvedValue("ok");
    await engine.execute("convex", "test-op", fn, fastConfig());
    const events = listener.mock.calls.map(([event]: [string]) => event);
    expect(events).toContain("retry-start");
    expect(events).toContain("retry-success");
  });

  it("unsubscribe stops notifications", async () => {
    const engine = new RetryEngine();
    const listener = vi.fn();
    const unsub = engine.subscribe(listener);
    unsub();
    const fn = vi.fn().mockResolvedValue("ok");
    await engine.execute("convex", "test-op", fn, fastConfig());
    expect(listener).not.toHaveBeenCalled();
  });

  it("cancelAll aborts in-flight retries", async () => {
    const engine = new RetryEngine();
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const promise = engine.execute(
      "convex",
      "test-op",
      fn,
      fastConfig({ maxRetries: 5, baseDelayMs: 1000 }),
    );
    // Cancel after first attempt
    setTimeout(() => engine.cancelAll(), 5);
    await expect(promise).rejects.toThrow();
  });
});
