import { describe, expect, test } from "vitest";
import { SKILL_TEMPLATES } from "../skillTemplates";

/**
 * skillTemplates.ts is a pure data file (no Convex functions), so we test
 * the exported constant directly without convex-test.
 */

describe("SKILL_TEMPLATES", () => {
  test("exports a non-empty array of templates", () => {
    expect(Array.isArray(SKILL_TEMPLATES)).toBe(true);
    expect(SKILL_TEMPLATES.length).toBeGreaterThan(0);
  });

  test("every template has required fields", () => {
    for (const template of SKILL_TEMPLATES) {
      expect(template.name).toBeTruthy();
      expect(template.slug).toBeTruthy();
      expect(template.domain).toBeTruthy();
      expect(template.targetPlatform).toBeTruthy();
      expect(template.content).toBeTruthy();
      expect(template.content.length).toBeGreaterThan(100);
    }
  });

  test("slugs are unique", () => {
    const slugs = SKILL_TEMPLATES.map((t) => t.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  test("domains are valid values", () => {
    const validDomains = new Set([
      "architecture",
      "backend",
      "frontend",
      "integration",
      "deployment",
      "testing",
      "review",
      "project",
    ]);
    for (const template of SKILL_TEMPLATES) {
      expect(validDomains.has(template.domain)).toBe(true);
    }
  });

  test("target platforms are valid values", () => {
    const validPlatforms = new Set(["salesforce_b2b", "bigcommerce_b2b", "platform_agnostic"]);
    for (const template of SKILL_TEMPLATES) {
      expect(validPlatforms.has(template.targetPlatform)).toBe(true);
    }
  });

  test("names are unique", () => {
    const names = SKILL_TEMPLATES.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});
