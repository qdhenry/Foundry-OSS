import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installDesktopGlobalErrorLogging,
  logDesktop,
  resolveErrorMessage,
  sanitizeForLog,
} from "./desktop-logging";

describe("desktop-logging", () => {
  beforeEach(() => {
    window.__FOUNDRY_DESKTOP_LOG_BUFFER__ = [];
    vi.restoreAllMocks();
  });

  it("sanitizes circular objects and thrown property accessors", () => {
    const payload: Record<string, unknown> = { ok: true };
    payload.self = payload;
    Object.defineProperty(payload, "boom", {
      enumerable: true,
      get() {
        throw new Error("access denied");
      },
    });

    const sanitized = sanitizeForLog(payload) as Record<string, unknown>;
    expect(sanitized.ok).toBe(true);
    expect(sanitized.self).toBe("[Circular]");
    expect(String(sanitized.boom)).toContain("Thrown");
  });

  it("records structured entries in the desktop log buffer", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    logDesktop("info", "test-scope", "Test message", {
      attempt: 1,
    });

    expect(infoSpy).toHaveBeenCalled();
    expect(window.__FOUNDRY_DESKTOP_LOG_BUFFER__).toHaveLength(1);
    expect(window.__FOUNDRY_DESKTOP_LOG_BUFFER__?.[0]).toMatchObject({
      level: "info",
      scope: "test-scope",
      message: "Test message",
    });
  });

  it("resolves nested error message objects safely", () => {
    const message = resolveErrorMessage(
      { message: { reason: "No default value" } },
      "fallback"
    );
    expect(message).toBe("fallback");
  });

  it("captures global error events without throwing", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    installDesktopGlobalErrorLogging();
    installDesktopGlobalErrorLogging();

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "runtime boom",
        filename: "app.tsx",
        lineno: 42,
        colno: 9,
        error: new Error("runtime boom"),
      })
    );

    expect(errorSpy).toHaveBeenCalled();
    expect(window.__FOUNDRY_DESKTOP_LOG_BUFFER__?.length).toBeGreaterThan(0);
  });
});
