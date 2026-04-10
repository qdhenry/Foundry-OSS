import { describe, expect, it } from "vitest";
import { PHASE_COLORS, PLATFORM_COLORS, PLATFORM_LABELS, STATUS_COLORS } from "./programStyles";

describe("programStyles", () => {
  describe("PHASE_COLORS", () => {
    it("has all phase keys", () => {
      expect(PHASE_COLORS).toHaveProperty("discovery");
      expect(PHASE_COLORS).toHaveProperty("build");
      expect(PHASE_COLORS).toHaveProperty("test");
      expect(PHASE_COLORS).toHaveProperty("deploy");
      expect(PHASE_COLORS).toHaveProperty("complete");
    });

    it("values contain Tailwind class strings", () => {
      for (const val of Object.values(PHASE_COLORS)) {
        expect(val).toContain("bg-");
        expect(val).toContain("text-");
      }
    });
  });

  describe("PLATFORM_COLORS", () => {
    it("has all platform keys", () => {
      expect(PLATFORM_COLORS).toHaveProperty("magento");
      expect(PLATFORM_COLORS).toHaveProperty("salesforce_b2b");
      expect(PLATFORM_COLORS).toHaveProperty("bigcommerce_b2b");
      expect(PLATFORM_COLORS).toHaveProperty("sitecore");
      expect(PLATFORM_COLORS).toHaveProperty("wordpress");
      expect(PLATFORM_COLORS).toHaveProperty("none");
    });
  });

  describe("PLATFORM_LABELS", () => {
    it("maps platform keys to readable labels", () => {
      expect(PLATFORM_LABELS.magento).toBe("Magento");
      expect(PLATFORM_LABELS.salesforce_b2b).toBe("Salesforce B2B");
      expect(PLATFORM_LABELS.bigcommerce_b2b).toBe("BigCommerce B2B");
      expect(PLATFORM_LABELS.sitecore).toBe("Sitecore");
      expect(PLATFORM_LABELS.wordpress).toBe("WordPress");
      expect(PLATFORM_LABELS.none).toBe("None");
    });
  });

  describe("STATUS_COLORS", () => {
    it("has all status keys", () => {
      expect(STATUS_COLORS).toHaveProperty("active");
      expect(STATUS_COLORS).toHaveProperty("paused");
      expect(STATUS_COLORS).toHaveProperty("complete");
      expect(STATUS_COLORS).toHaveProperty("archived");
    });
  });
});
