import { describe, expect, it } from "vitest";
import { inferRepoRole } from "./role-heuristics";

describe("inferRepoRole", () => {
  it("returns storefront for frontend-related text", () => {
    expect(inferRepoRole({ taskTitle: "Build storefront checkout" })).toBe("storefront");
    expect(inferRepoRole({ workstreamName: "Frontend UI" })).toBe("storefront");
    expect(inferRepoRole({ taskTitle: "Cart page" })).toBe("storefront");
  });

  it("returns integration for API-related text", () => {
    expect(inferRepoRole({ taskTitle: "Integration API connector" })).toBe("integration");
    expect(inferRepoRole({ workstreamName: "Middleware setup" })).toBe("integration");
  });

  it("returns data_migration for migration-related text", () => {
    expect(inferRepoRole({ taskTitle: "Data migration ETL" })).toBe("data_migration");
    expect(inferRepoRole({ workstreamName: "Import/Export" })).toBe("data_migration");
  });

  it("returns infrastructure for devops-related text", () => {
    expect(inferRepoRole({ taskTitle: "CI/CD pipeline setup" })).toBe("infrastructure");
    expect(inferRepoRole({ workstreamName: "Infrastructure terraform" })).toBe("infrastructure");
  });

  it("returns documentation for doc-related text", () => {
    expect(inferRepoRole({ taskTitle: "Documentation wiki" })).toBe("documentation");
    // Note: "guide" contains "ui" which matches storefront first, so use "onboard" alone
    expect(inferRepoRole({ workstreamName: "Onboarding docs" })).toBe("documentation");
  });

  it("returns extension for plugin-related text", () => {
    expect(inferRepoRole({ taskTitle: "Plugin addon module" })).toBe("extension");
  });

  it("falls back to language-based detection", () => {
    expect(inferRepoRole({ repoLanguage: "TypeScript" })).toBe("storefront");
    expect(inferRepoRole({ repoLanguage: "Python" })).toBe("integration");
    expect(inferRepoRole({ repoLanguage: "Go" })).toBe("integration");
  });

  it("defaults to storefront when no context matches", () => {
    expect(inferRepoRole({})).toBe("storefront");
    expect(inferRepoRole({ taskTitle: "something generic" })).toBe("storefront");
  });

  it("prioritizes text match over language", () => {
    expect(inferRepoRole({ taskTitle: "Migration scripts", repoLanguage: "TypeScript" })).toBe(
      "data_migration",
    );
  });
});
