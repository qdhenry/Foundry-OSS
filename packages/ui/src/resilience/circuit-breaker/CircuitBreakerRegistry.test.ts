import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircuitBreakerRegistry } from "./CircuitBreakerRegistry";

// Mock BroadcastChannel and sessionStorage
const mockPostMessage = vi.fn();
const mockClose = vi.fn();
vi.stubGlobal(
  "BroadcastChannel",
  class {
    onmessage: ((event: any) => void) | null = null;
    postMessage = mockPostMessage;
    close = mockClose;
  },
);
vi.stubGlobal("sessionStorage", {
  store: {} as Record<string, string>,
  getItem(key: string) {
    return this.store[key] ?? null;
  },
  setItem(key: string, value: string) {
    this.store[key] = value;
  },
  removeItem(key: string) {
    delete this.store[key];
  },
});

describe("CircuitBreakerRegistry", () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    (sessionStorage as any).store = {};
    registry = new CircuitBreakerRegistry();
  });

  afterEach(() => {
    registry.destroy();
  });

  it("initializes breakers for all services", () => {
    const all = registry.getAll();
    expect(all.size).toBeGreaterThan(0);
    expect(all.has("convex")).toBe(true);
    expect(all.has("clerk")).toBe(true);
    expect(all.has("anthropic")).toBe(true);
  });

  it("get returns a circuit breaker for known service", () => {
    const breaker = registry.get("convex");
    expect(breaker).toBeDefined();
    expect(breaker.getState().service).toBe("convex");
  });

  it("get throws for unknown service", () => {
    expect(() => registry.get("nonexistent" as any)).toThrow();
  });

  it("simulateOutage forces a breaker open", () => {
    registry.simulateOutage("convex");
    const state = registry.get("convex").getState();
    expect(state.state).toBe("open");
  });

  it("simulateRecovery resets a breaker", () => {
    registry.simulateOutage("convex");
    registry.simulateRecovery("convex");
    const state = registry.get("convex").getState();
    expect(state.state).toBe("closed");
  });

  it("subscribe notifies on breaker state changes", () => {
    const listener = vi.fn();
    registry.subscribe(listener);
    registry.simulateOutage("clerk");
    expect(listener).toHaveBeenCalledWith("clerk", expect.objectContaining({ state: "open" }));
  });

  it("unsubscribe stops notifications", () => {
    const listener = vi.fn();
    const unsub = registry.subscribe(listener);
    unsub();
    registry.simulateOutage("clerk");
    expect(listener).not.toHaveBeenCalled();
  });

  it("persists state to sessionStorage on change", () => {
    registry.simulateOutage("convex");
    const stored = sessionStorage.getItem("foundry:circuit-breakers");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.convex.state).toBe("open");
  });

  it("destroy closes broadcast channel", () => {
    registry.destroy();
    expect(mockClose).toHaveBeenCalled();
  });
});
