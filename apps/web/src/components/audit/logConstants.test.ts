import { describe, expect, it } from "vitest";
import { formatLogTimestamp, LOG_LEVEL_BADGE } from "./logConstants";

describe("logConstants", () => {
  describe("LOG_LEVEL_BADGE", () => {
    it("has entries for all expected levels", () => {
      expect(LOG_LEVEL_BADGE.info).toBeDefined();
      expect(LOG_LEVEL_BADGE.stdout).toBeDefined();
      expect(LOG_LEVEL_BADGE.stderr).toBeDefined();
      expect(LOG_LEVEL_BADGE.system).toBeDefined();
      expect(LOG_LEVEL_BADGE.error).toBeDefined();
    });

    it("each entry has bg and text properties", () => {
      for (const [, badge] of Object.entries(LOG_LEVEL_BADGE)) {
        expect(badge).toHaveProperty("bg");
        expect(badge).toHaveProperty("text");
      }
    });
  });

  describe("formatLogTimestamp", () => {
    it("formats a timestamp as HH:MM:SS", () => {
      // Use a known timestamp
      const ts = new Date(2026, 0, 1, 14, 30, 45).getTime();
      const result = formatLogTimestamp(ts);
      expect(result).toBe("14:30:45");
    });
  });
});
