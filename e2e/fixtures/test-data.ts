/**
 * Factory functions for generating test data used in E2E tests.
 */

let counter = 0;

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${++counter}`;
}

export function makeProgram(overrides: Record<string, unknown> = {}) {
  return {
    name: unique("E2E Program"),
    clientName: unique("E2E Client"),
    engagementType: "greenfield" as const,
    workstreams: [
      { name: "Development", shortCode: "WS-1", sortOrder: 1 },
    ],
    ...overrides,
  };
}

export function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    title: unique("E2E Task"),
    priority: "medium" as const,
    ...overrides,
  };
}

export function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    name: unique("E2E Skill"),
    type: "analysis" as const,
    ...overrides,
  };
}

export function makeRisk(overrides: Record<string, unknown> = {}) {
  return {
    title: unique("E2E Risk"),
    severity: "medium" as const,
    likelihood: "medium" as const,
    ...overrides,
  };
}
