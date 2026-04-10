import { describe, expect, test } from "vitest";
import { buildAnalysisSystemPrompt } from "../ai/prompts";

const BASE_CONTEXT = {
  targetPlatform: "none" as const,
  workstreams: [
    { shortCode: "WS-1", name: "Architecture" },
    { shortCode: "WS-2", name: "Development" },
  ],
  existingRequirementTitles: [],
};

describe("buildAnalysisSystemPrompt", () => {
  test("uses delivery analyst role for greenfield", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
    });

    expect(result).toContain("delivery discovery analyst for software delivery programs");
    expect(result).not.toContain("specializing in");
  });

  test("uses migration-specific role for migration engagement", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      targetPlatform: "salesforce_b2b",
      engagementType: "migration",
    });

    expect(result).toContain("specializing in Salesforce B2B Commerce migrations");
  });

  test("uses migration-specific role when targetPlatform is set", () => {
    // Even without engagementType, targetPlatform !== "none" triggers migration mode
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      targetPlatform: "bigcommerce_b2b",
    });

    expect(result).toContain("specializing in BigCommerce B2B Edition migrations");
  });

  test("includes target-platform section only for migrations", () => {
    const migrationResult = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      targetPlatform: "salesforce_b2b",
      engagementType: "migration",
    });
    expect(migrationResult).toContain("<target-platform>");
    expect(migrationResult).toContain("Salesforce B2B Commerce");

    const greenfieldResult = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
    });
    expect(greenfieldResult).not.toContain("<target-platform>");
  });

  test("includes tech stack section when provided", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
      techStack: [
        { category: "frontend", technologies: ["React", "TypeScript"] },
        { category: "database", technologies: ["PostgreSQL"] },
      ],
    });

    expect(result).toContain("<tech-stack>");
    expect(result).toContain("frontend: React, TypeScript");
    expect(result).toContain("database: PostgreSQL");
    expect(result).toContain("</tech-stack>");
  });

  test("omits tech stack section when not provided", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
    });

    expect(result).not.toContain("<tech-stack>");
  });

  test("omits tech stack section when empty array", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
      techStack: [],
    });

    expect(result).not.toContain("<tech-stack>");
  });

  test("uses migration-specific quality standards for migrations", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      targetPlatform: "salesforce_b2b",
      engagementType: "migration",
    });

    expect(result).toContain("migration-specific content");
    expect(result).toContain("migration criticality");
  });

  test("uses generic quality standards for non-migrations", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
    });

    expect(result).toContain("project-specific content");
    expect(result).toContain("delivery criticality");
  });

  test("includes workstreams section", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
      workstreams: [
        { shortCode: "WS-1", name: "Architecture", description: "System design" },
        { shortCode: "WS-2", name: "Development", description: "Core coding" },
        { shortCode: "WS-3", name: "Testing" },
      ],
    });

    expect(result).toContain("<workstreams>");
    expect(result).toContain("WS-1: Architecture");
    expect(result).toContain("System design");
    expect(result).toContain("WS-2: Development");
    expect(result).toContain("Core coding");
    expect(result).toContain("WS-3: Testing");
    expect(result).toContain("</workstreams>");
  });

  test("includes duplicate warning when existing requirements exist", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
      existingRequirementTitles: ["User authentication flow", "Payment processing module"],
    });

    expect(result).toContain("<existing-requirements>");
    expect(result).toContain("User authentication flow");
    expect(result).toContain("Payment processing module");
    expect(result).toContain("matchType");
    expect(result).toContain("potentialMatch");
  });

  test("omits duplicate warning when no existing requirements", () => {
    const result = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
      existingRequirementTitles: [],
    });

    expect(result).not.toContain("<existing-requirements>");
  });

  test("uses correct impact label", () => {
    const migrationResult = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      targetPlatform: "salesforce_b2b",
      engagementType: "migration",
    });
    expect(migrationResult).toContain("migration impact");

    const greenfieldResult = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
    });
    expect(greenfieldResult).toContain("delivery impact");
  });

  test("analyzes migration documents for migrations and project documents otherwise", () => {
    const migrationResult = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      targetPlatform: "salesforce_b2b",
      engagementType: "migration",
    });
    expect(migrationResult).toContain("migration documents");

    const greenfieldResult = buildAnalysisSystemPrompt({
      ...BASE_CONTEXT,
      engagementType: "greenfield",
    });
    expect(greenfieldResult).toContain("project documents");
  });
});
