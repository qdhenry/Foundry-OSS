import { describe, expect, test } from "vitest";
import { assemblePrompt } from "../model/context";

function mockProgram(overrides: Record<string, any> = {}) {
  return {
    _id: "mock-program-id",
    _creationTime: Date.now(),
    orgId: "org-1",
    name: "Test Program",
    clientName: "Test Client",
    sourcePlatform: "none",
    targetPlatform: "none",
    phase: "discovery",
    status: "active",
    ...overrides,
  } as any;
}

function mockSkill(overrides: Record<string, any> = {}) {
  return {
    _id: "mock-skill-id",
    _creationTime: Date.now(),
    name: "Test Skill",
    domain: "testing",
    currentVersion: 1,
    content: "Do the thing carefully.",
    ...overrides,
  } as any;
}

function mockRequirement(overrides: Record<string, any> = {}) {
  return {
    _id: "mock-req-id",
    _creationTime: Date.now(),
    refId: "REQ-001",
    title: "Test Requirement",
    priority: "must_have",
    fitGap: "native",
    status: "draft",
    ...overrides,
  } as any;
}

function mockExecution(overrides: Record<string, any> = {}) {
  return {
    _id: "mock-exec-id",
    _creationTime: Date.now(),
    taskType: "analysis",
    outputSummary: "Completed analysis",
    reviewStatus: "approved",
    ...overrides,
  } as any;
}

describe("assemblePrompt", () => {
  test("includes engagement type in program context", () => {
    const result = assemblePrompt({
      program: mockProgram({ engagementType: "greenfield" }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).toContain("Engagement Type: greenfield");
    expect(result).toContain("<program_context>");
  });

  test("formats engagement type with spaces replacing underscores", () => {
    const result = assemblePrompt({
      program: mockProgram({ engagementType: "ongoing_product_dev" }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).toContain("Engagement Type: ongoing product dev");
  });

  test("includes tech stack in program context", () => {
    const result = assemblePrompt({
      program: mockProgram({
        techStack: [
          { category: "frontend", technologies: ["React", "TypeScript"] },
          { category: "backend", technologies: ["Node.js", "Express"] },
        ],
      }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).toContain("Tech Stack: frontend: React, TypeScript; backend: Node.js, Express");
  });

  test("shows source to target for migration programs", () => {
    const result = assemblePrompt({
      program: mockProgram({
        sourcePlatform: "magento",
        targetPlatform: "salesforce_b2b",
        engagementType: "migration",
      }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).toContain("Source: magento");
    expect(result).toContain("Target: salesforce_b2b");
  });

  test("omits source/target when platforms are 'none'", () => {
    const result = assemblePrompt({
      program: mockProgram({
        sourcePlatform: "none",
        targetPlatform: "none",
      }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).not.toContain("Source:");
    expect(result).not.toContain("Target:");
  });

  test("omits source/target when platforms are missing", () => {
    const result = assemblePrompt({
      program: mockProgram({
        sourcePlatform: undefined,
        targetPlatform: undefined,
      }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).not.toContain("Source:");
    expect(result).not.toContain("Target:");
  });

  test("handles legacy program without engagementType", () => {
    const result = assemblePrompt({
      program: mockProgram({ engagementType: undefined }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).not.toContain("Engagement Type:");
    // Should still have program_context section
    expect(result).toContain("<program_context>");
    expect(result).toContain("Name: Test Program");
  });

  test("handles legacy program without techStack", () => {
    const result = assemblePrompt({
      program: mockProgram({ techStack: undefined }),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).not.toContain("Tech Stack:");
    expect(result).toContain("<program_context>");
  });

  test("includes all sections in order", () => {
    const result = assemblePrompt({
      program: mockProgram({ engagementType: "greenfield" }),
      requirements: [mockRequirement()],
      skill: mockSkill(),
      recentExecutions: [mockExecution()],
      taskPrompt: "Do the task",
    });

    const programIdx = result.indexOf("<program_context>");
    const reqIdx = result.indexOf("<requirements");
    const skillIdx = result.indexOf("<skill_instructions");
    const execIdx = result.indexOf("<recent_executions");
    const taskIdx = result.indexOf("<task>");

    expect(programIdx).toBeGreaterThanOrEqual(0);
    expect(reqIdx).toBeGreaterThan(programIdx);
    expect(skillIdx).toBeGreaterThan(reqIdx);
    expect(execIdx).toBeGreaterThan(skillIdx);
    expect(taskIdx).toBeGreaterThan(execIdx);
  });

  test("includes requirements with correct format", () => {
    const result = assemblePrompt({
      program: mockProgram(),
      requirements: [
        mockRequirement({
          refId: "REQ-001",
          title: "First Req",
          priority: "must_have",
          fitGap: "native",
          status: "draft",
        }),
        mockRequirement({
          refId: "REQ-002",
          title: "Second Req",
          priority: "should_have",
          fitGap: "config",
          status: "complete",
        }),
      ],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).toContain('count="2"');
    expect(result).toContain("REQ-001: First Req (must_have, native, draft)");
    expect(result).toContain("REQ-002: Second Req (should_have, config, complete)");
  });

  test("omits recent_executions section when empty", () => {
    const result = assemblePrompt({
      program: mockProgram(),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Do the task",
    });

    expect(result).not.toContain("<recent_executions");
  });

  test("includes task prompt in task section", () => {
    const result = assemblePrompt({
      program: mockProgram(),
      requirements: [],
      skill: mockSkill(),
      recentExecutions: [],
      taskPrompt: "Analyze the document and extract requirements",
    });

    expect(result).toContain("<task>");
    expect(result).toContain("Analyze the document and extract requirements");
    expect(result).toContain("</task>");
  });
});
