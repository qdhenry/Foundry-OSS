import { describe, expect, it } from "vitest";
import { formatLogTimestamp, LOG_LEVEL_BADGE } from "./logConstants";

describe("LOG_LEVEL_BADGE", () => {
  it("has entries for all expected levels", () => {
    expect(LOG_LEVEL_BADGE.info).toBeDefined();
    expect(LOG_LEVEL_BADGE.stdout).toBeDefined();
    expect(LOG_LEVEL_BADGE.stderr).toBeDefined();
    expect(LOG_LEVEL_BADGE.system).toBeDefined();
    expect(LOG_LEVEL_BADGE.error).toBeDefined();
  });

  it("each badge has bg and text properties", () => {
    for (const [, badge] of Object.entries(LOG_LEVEL_BADGE)) {
      expect(badge.bg).toBeDefined();
      expect(badge.text).toBeDefined();
      expect(typeof badge.bg).toBe("string");
      expect(typeof badge.text).toBe("string");
    }
  });

  it("error and stderr share the same error styling", () => {
    expect(LOG_LEVEL_BADGE.error.bg).toBe(LOG_LEVEL_BADGE.stderr.bg);
    expect(LOG_LEVEL_BADGE.error.text).toBe(LOG_LEVEL_BADGE.stderr.text);
  });
});

describe("formatLogTimestamp", () => {
  it("formats a timestamp as HH:MM:SS", () => {
    // Create a known timestamp
    const date = new Date("2025-06-15T14:30:45Z");
    const result = formatLogTimestamp(date.getTime());
    // Should contain two-digit hours, minutes, and seconds separated by colons
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("returns a string", () => {
    expect(typeof formatLogTimestamp(Date.now())).toBe("string");
  });
});
