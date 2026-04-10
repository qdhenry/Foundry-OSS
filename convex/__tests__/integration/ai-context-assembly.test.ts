import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Doc } from "../../_generated/dataModel";
import { assemblePrompt } from "../../model/context";
import schema from "../../schema";
import { modules } from "../../test.helpers";

/**
 * Integration tests for the AI context assembly pipeline:
 * - Full prompt assembly from 5 layers (program, requirements, skill, executions, task)
 * - XML tag structure validation
 * - Empty/minimal context handling
 * - Large context assembly (many requirements, long skill content)
 * - Execution history inclusion
 */

// ── Helpers ──────────────────────────────────────────────────────────

function makeProgram(overrides: Record<string, unknown> = {}) {
  return {
    _id: "prog-1" as any,
    _creationTime: Date.now(),
    orgId: "org-ctx",
    name: "AcmeCorp Migration",
    clientName: "AcmeCorp",
    sourcePlatform: "magento" as const,
    targetPlatform: "salesforce_b2b" as const,
    phase: "build" as const,
    status: "active" as const,
    ...overrides,
  };
}

function makeRequirement(refId: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: `req-${refId}` as any,
    _creationTime: Date.now(),
    orgId: "org-ctx",
    programId: "prog-1" as any,
    refId,
    title,
    priority: "must_have" as const,
    fitGap: "custom_dev" as const,
    status: "approved" as const,
    ...overrides,
  };
}

function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    _id: "skill-1" as any,
    _creationTime: Date.now(),
    orgId: "org-ctx",
    programId: "prog-1" as any,
    name: "Catalog Migration Skill",
    domain: "backend" as const,
    targetPlatform: "salesforce_b2b" as const,
    currentVersion: "1.0.0",
    content:
      "You are an expert in migrating product catalogs from Magento to Salesforce B2B Commerce.",
    lineCount: 1,
    status: "active" as const,
    ...overrides,
  };
}

function makeExecution(
  taskType: string,
  outputSummary?: string,
  reviewStatus: Doc<"agentExecutions">["reviewStatus"] = "accepted",
) {
  return {
    _id: `exec-${Math.random().toString(36).slice(2)}` as any,
    _creationTime: Date.now(),
    orgId: "org-ctx",
    programId: "prog-1" as any,
    executionMode: "platform" as const,
    trigger: "manual" as const,
    taskType,
    outputSummary,
    reviewStatus,
  };
}

// ── Full Prompt Assembly ────────────────────────────────────────────

describe("ai-context-assembly: full prompt assembly", () => {
  test("assembles prompt with all 5 layers", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [
        makeRequirement("PROD-01", "Product catalog sync"),
        makeRequirement("PROD-02", "Price book migration"),
      ],
      skill: makeSkill(),
      recentExecutions: [makeExecution("catalog_sync", "Synced 1500 products successfully")],
      taskPrompt: "Migrate the product catalog from Magento to Salesforce B2B Commerce",
    });

    // Verify all 5 sections present
    expect(prompt).toContain("<program_context>");
    expect(prompt).toContain("</program_context>");
    expect(prompt).toContain('<requirements count="2">');
    expect(prompt).toContain("</requirements>");
    expect(prompt).toContain("<skill_instructions");
    expect(prompt).toContain("</skill_instructions>");
    expect(prompt).toContain('<recent_executions count="1">');
    expect(prompt).toContain("</recent_executions>");
    expect(prompt).toContain("<task>");
    expect(prompt).toContain("</task>");
  });

  test("includes program context details", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill(),
      recentExecutions: [],
      taskPrompt: "test",
    });

    expect(prompt).toContain("Name: AcmeCorp Migration");
    expect(prompt).toContain("Client: AcmeCorp");
    expect(prompt).toContain("Source: magento → Target: salesforce_b2b");
    expect(prompt).toContain("Phase: build");
    expect(prompt).toContain("Status: active");
  });

  test("includes requirement details with metadata", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [
        makeRequirement("PROD-01", "Product catalog sync", {
          priority: "must_have",
          fitGap: "custom_dev",
          status: "approved",
        }),
      ],
      skill: makeSkill(),
      recentExecutions: [],
      taskPrompt: "test",
    });

    expect(prompt).toContain("PROD-01: Product catalog sync (must_have, custom_dev, approved)");
  });

  test("includes skill instructions with attributes", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill({
        name: "API Integration Skill",
        domain: "integration",
        currentVersion: "2.1.0",
      }),
      recentExecutions: [],
      taskPrompt: "test",
    });

    expect(prompt).toContain('name="API Integration Skill"');
    expect(prompt).toContain('domain="integration"');
    expect(prompt).toContain('version="2.1.0"');
  });

  test("includes execution history with output summaries", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill(),
      recentExecutions: [
        makeExecution("data_migration", "Migrated 2000 records", "accepted"),
        makeExecution("validation", "3 validation errors found", "revised"),
      ],
      taskPrompt: "test",
    });

    expect(prompt).toContain("data_migration - Migrated 2000 records (accepted)");
    expect(prompt).toContain("validation - 3 validation errors found (revised)");
  });

  test("includes task prompt in task section", () => {
    const taskPrompt = "Implement the payment gateway integration with Stripe";
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill(),
      recentExecutions: [],
      taskPrompt,
    });

    expect(prompt).toContain(`<task>\n${taskPrompt}\n</task>`);
  });
});

// ── Empty/Minimal Context ───────────────────────────────────────────

describe("ai-context-assembly: empty/minimal context", () => {
  test("handles zero requirements", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill(),
      recentExecutions: [],
      taskPrompt: "test",
    });

    expect(prompt).toContain('<requirements count="0">');
  });

  test("omits execution history section when empty", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill(),
      recentExecutions: [],
      taskPrompt: "test",
    });

    expect(prompt).not.toContain("<recent_executions");
  });

  test("handles execution with no output summary", () => {
    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill(),
      recentExecutions: [makeExecution("setup", undefined, "pending")],
      taskPrompt: "test",
    });

    expect(prompt).toContain("setup - no output (pending)");
  });
});

// ── Large Context ───────────────────────────────────────────────────

describe("ai-context-assembly: large context", () => {
  test("assembles prompt with many requirements", () => {
    const requirements = Array.from({ length: 50 }, (_, i) =>
      makeRequirement(`REQ-${String(i + 1).padStart(3, "0")}`, `Requirement ${i + 1}`),
    );

    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements,
      skill: makeSkill(),
      recentExecutions: [],
      taskPrompt: "Execute all requirements",
    });

    expect(prompt).toContain('<requirements count="50">');
    expect(prompt).toContain("REQ-001:");
    expect(prompt).toContain("REQ-050:");
  });

  test("handles long skill content", () => {
    const longContent = "Line of instruction\n".repeat(500);

    const prompt = assemblePrompt({
      program: makeProgram(),
      requirements: [],
      skill: makeSkill({ content: longContent }),
      recentExecutions: [],
      taskPrompt: "test",
    });

    expect(prompt).toContain(longContent);
  });
});

// ── End-to-End Context from Database ────────────────────────────────

describe("ai-context-assembly: database-backed context", () => {
  test("loads full context hierarchy from database and assembles prompt", async () => {
    const t = convexTest(schema, modules);

    // Seed full hierarchy
    const _userId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        clerkId: "ctx-user",
        email: "ctx@example.com",
        name: "Context User",
        orgIds: ["org-ctx"],
        role: "admin",
      });
    });

    const programId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("programs", {
        orgId: "org-ctx",
        name: "Context Program",
        clientName: "Context Client",
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        phase: "build",
        status: "active",
      });
    });

    const workstreamId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("workstreams", {
        orgId: "org-ctx",
        programId,
        name: "Backend WS",
        shortCode: "BE",
        status: "on_track",
        sortOrder: 1,
      });
    });

    // Create requirements
    const _reqIds = await t.run(async (ctx: any) => {
      const r1 = await ctx.db.insert("requirements", {
        orgId: "org-ctx",
        programId,
        workstreamId,
        refId: "CTX-01",
        title: "API Authentication",
        priority: "must_have",
        fitGap: "custom_dev",
        status: "approved",
      });
      const r2 = await ctx.db.insert("requirements", {
        orgId: "org-ctx",
        programId,
        workstreamId,
        refId: "CTX-02",
        title: "Data Validation",
        priority: "should_have",
        fitGap: "config",
        status: "in_progress",
      });
      return [r1, r2];
    });

    // Create skill
    const skillId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("skills", {
        orgId: "org-ctx",
        programId,
        name: "Backend Auth Skill",
        domain: "backend",
        targetPlatform: "salesforce_b2b",
        currentVersion: "1.2.0",
        content: "Expert in implementing JWT-based authentication for B2B Commerce APIs.",
        lineCount: 1,
        status: "active",
      });
    });

    // Create execution history
    await t.run(async (ctx: any) => {
      await ctx.db.insert("agentExecutions", {
        orgId: "org-ctx",
        programId,
        skillId,
        executionMode: "platform",
        trigger: "manual",
        taskType: "auth_setup",
        outputSummary: "JWT middleware configured",
        reviewStatus: "accepted",
      });
    });

    // Load data from DB
    const program = await t.run(async (ctx: any) => await ctx.db.get(programId));
    const requirements = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("requirements")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });
    const skill = await t.run(async (ctx: any) => await ctx.db.get(skillId));
    const executions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("agentExecutions")
        .withIndex("by_program", (q: any) => q.eq("programId", programId))
        .collect();
    });

    // Assemble prompt
    const prompt = assemblePrompt({
      program,
      requirements,
      skill,
      recentExecutions: executions,
      taskPrompt: "Implement OAuth 2.0 token refresh for the B2B Commerce API",
    });

    expect(prompt).toContain("Context Program");
    expect(prompt).toContain("CTX-01: API Authentication");
    expect(prompt).toContain("CTX-02: Data Validation");
    expect(prompt).toContain("Backend Auth Skill");
    expect(prompt).toContain("auth_setup - JWT middleware configured (accepted)");
    expect(prompt).toContain("OAuth 2.0 token refresh");
  });
});
