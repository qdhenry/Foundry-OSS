import { describe, expect, it } from "vitest";
import {
  ALL_SERVICES,
  CRITICAL_SERVICES,
  DEFAULT_TOAST_DURATION,
  MAX_VISIBLE_TOASTS,
  SERVICE_CONFIGS,
} from "./constants";

describe("resilience constants", () => {
  it("ALL_SERVICES contains expected services", () => {
    expect(ALL_SERVICES).toContain("convex");
    expect(ALL_SERVICES).toContain("clerk");
    expect(ALL_SERVICES).toContain("anthropic");
    expect(ALL_SERVICES).toContain("github");
    expect(ALL_SERVICES.length).toBeGreaterThanOrEqual(9);
  });

  it("CRITICAL_SERVICES only includes critical services", () => {
    for (const service of CRITICAL_SERVICES) {
      expect(SERVICE_CONFIGS[service].critical).toBe(true);
    }
    expect(CRITICAL_SERVICES).toContain("convex");
    expect(CRITICAL_SERVICES).toContain("clerk");
  });

  it("SERVICE_CONFIGS has valid config for each service", () => {
    for (const service of ALL_SERVICES) {
      const config = SERVICE_CONFIGS[service];
      expect(config.displayName).toBeTruthy();
      expect(config.circuit.failureThreshold).toBeGreaterThan(0);
      expect(config.circuit.resetTimeoutMs).toBeGreaterThan(0);
      expect(config.retry.maxRetries).toBeGreaterThan(0);
      expect(config.retry.baseDelayMs).toBeGreaterThan(0);
    }
  });

  it("DEFAULT_TOAST_DURATION and MAX_VISIBLE_TOASTS are set", () => {
    expect(DEFAULT_TOAST_DURATION).toBe(4_000);
    expect(MAX_VISIBLE_TOASTS).toBe(3);
  });
});
