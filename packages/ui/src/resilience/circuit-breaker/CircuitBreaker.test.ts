import { describe, expect, it, vi } from "vitest";
import type { CircuitBreakerConfig } from "../types";
import { CircuitBreaker } from "./CircuitBreaker";

function makeConfig(overrides?: Partial<CircuitBreakerConfig>): CircuitBreakerConfig {
  return {
    service: "convex",
    failureThreshold: 3,
    resetTimeoutMs: 5_000,
    halfOpenMaxAttempts: 1,
    monitorWindowMs: 60_000,
    ...overrides,
  };
}

describe("CircuitBreaker", () => {
  it("starts in closed state", () => {
    const cb = new CircuitBreaker(makeConfig());
    expect(cb.getState().state).toBe("closed");
    expect(cb.isAvailable()).toBe(true);
  });

  it("opens after reaching failure threshold", () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 2 }));
    cb.recordFailure();
    expect(cb.getState().state).toBe("closed");
    cb.recordFailure();
    expect(cb.getState().state).toBe("open");
    expect(cb.isAvailable()).toBe(false);
  });

  it("resets failure count on success in closed state", () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 3 }));
    cb.recordFailure();
    cb.recordFailure();
    cb.recordSuccess();
    expect(cb.getState().failureCount).toBe(0);
  });

  it("transitions from open to half-open after cooldown", () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 1, resetTimeoutMs: 100 }));
    cb.recordFailure();
    expect(cb.getState().state).toBe("open");

    vi.useFakeTimers();
    vi.advanceTimersByTime(150);
    expect(cb.isAvailable()).toBe(true);
    expect(cb.getState().state).toBe("half-open");
    vi.useRealTimers();
  });

  it("transitions from half-open to closed on success", () => {
    const cb = new CircuitBreaker(
      makeConfig({ failureThreshold: 1, resetTimeoutMs: 100, halfOpenMaxAttempts: 1 }),
    );
    cb.recordFailure();
    vi.useFakeTimers();
    vi.advanceTimersByTime(150);
    cb.isAvailable(); // triggers half-open
    cb.recordSuccess();
    expect(cb.getState().state).toBe("closed");
    vi.useRealTimers();
  });

  it("returns to open on failure in half-open", () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 1, resetTimeoutMs: 100 }));
    cb.recordFailure();
    vi.useFakeTimers();
    vi.advanceTimersByTime(150);
    cb.isAvailable(); // triggers half-open
    cb.recordFailure();
    expect(cb.getState().state).toBe("open");
    vi.useRealTimers();
  });

  it("notifies listeners on state changes", () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 1 }));
    const listener = vi.fn();
    cb.subscribe(listener);
    cb.recordFailure();
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0].state).toBe("open");
  });

  it("unsubscribes listener correctly", () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 1 }));
    const listener = vi.fn();
    const unsub = cb.subscribe(listener);
    unsub();
    cb.recordFailure();
    expect(listener).not.toHaveBeenCalled();
  });

  it("reset restores to closed state", () => {
    const cb = new CircuitBreaker(makeConfig({ failureThreshold: 1 }));
    cb.recordFailure();
    expect(cb.getState().state).toBe("open");
    cb.reset();
    expect(cb.getState().state).toBe("closed");
    expect(cb.isAvailable()).toBe(true);
  });

  it("forceOpen sets circuit to open", () => {
    const cb = new CircuitBreaker(makeConfig());
    cb.forceOpen();
    expect(cb.getState().state).toBe("open");
    expect(cb.isAvailable()).toBe(false);
  });

  it("restore hydrates from persisted state", () => {
    const cb = new CircuitBreaker(makeConfig());
    cb.restore({
      service: "convex",
      state: "open",
      failureCount: 5,
      lastFailureAt: Date.now(),
      lastSuccessAt: null,
      nextRetryAt: Date.now() + 10_000,
      consecutiveSuccesses: 0,
    });
    expect(cb.getState().state).toBe("open");
    expect(cb.getState().failureCount).toBe(5);
  });

  it("getState returns complete state object", () => {
    const cb = new CircuitBreaker(makeConfig());
    const state = cb.getState();
    expect(state.service).toBe("convex");
    expect(state.state).toBe("closed");
    expect(state.failureCount).toBe(0);
    expect(state.lastFailureAt).toBeNull();
    expect(state.lastSuccessAt).toBeNull();
    expect(state.nextRetryAt).toBeNull();
    expect(state.consecutiveSuccesses).toBe(0);
  });
});
