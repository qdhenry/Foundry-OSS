import { describe, expect, it } from "vitest";
import { ROLE_OPTIONS } from "./types";

describe("source-control types", () => {
  it("exports 6 role options", () => {
    expect(ROLE_OPTIONS).toHaveLength(6);
  });

  it("has expected role values", () => {
    const values = ROLE_OPTIONS.map((o) => o.value);
    expect(values).toContain("storefront");
    expect(values).toContain("integration");
    expect(values).toContain("data_migration");
    expect(values).toContain("infrastructure");
    expect(values).toContain("extension");
    expect(values).toContain("documentation");
  });

  it("each option has a non-empty label", () => {
    for (const opt of ROLE_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});
