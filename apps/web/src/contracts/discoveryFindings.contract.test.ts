import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DISCOVERY_FINDINGS_PATH = path.resolve(process.cwd(), "convex/discoveryFindings.ts");

function readDiscoveryFindingsSource(): string {
  return readFileSync(DISCOVERY_FINDINGS_PATH, "utf8");
}

describe("discoveryFindings contract", () => {
  it("includes action_item in the type validator union", () => {
    const source = readDiscoveryFindingsSource();
    const typeValidatorBlockMatch = source.match(/const typeValidator = v\.union\(([\s\S]*?)\);\n/);

    expect(typeValidatorBlockMatch).not.toBeNull();

    const literals = Array.from(
      typeValidatorBlockMatch?.[1].matchAll(/v\.literal\("([^"]+)"\)/g),
    ).map((match) => match[1]);

    expect(literals).toContain("action_item");
  });

  it("includes action_item in listByDocument type ordering", () => {
    const source = readDiscoveryFindingsSource();
    const typeOrderBlockMatch = source.match(
      /const typeOrder: Record<string, number> = \{([\s\S]*?)\};/,
    );

    expect(typeOrderBlockMatch).not.toBeNull();
    expect(typeOrderBlockMatch?.[1]).toMatch(/action_item:\s*\d+/);
  });

  it("imports action_item findings into tasks with fallback defaults", () => {
    const source = readDiscoveryFindingsSource();

    expect(source).toMatch(/case "action_item": \{/);
    expect(source).toMatch(/ctx\.db\.insert\("tasks", \{/);
    expect(source).toMatch(/importedAs:\s*\{\s*type:\s*"task",\s*id:\s*taskId\s*\}/);
    expect(source).toMatch(
      /const priority = isValidValue\(data\.priority,\s*VALID_TASK_PRIORITIES\)/,
    );
    expect(source).toMatch(/:\s*"medium";/);
    expect(source).toMatch(/const status = isValidValue\(data\.status,\s*VALID_TASK_STATUSES\)/);
    expect(source).toMatch(/:\s*"backlog";/);
    expect(source).toMatch(/counts\.tasks\+\+/);
  });

  it("preserves existing import branches and extends counts with tasks", () => {
    const source = readDiscoveryFindingsSource();

    expect(source).toMatch(/case "requirement": \{/);
    expect(source).toMatch(/case "risk": \{/);
    expect(source).toMatch(/case "integration": \{/);
    expect(source).toMatch(/case "decision": \{/);
    expect(source).toMatch(
      /return \{[\s\S]*requirements:\s*0,[\s\S]*risks:\s*0,[\s\S]*integrations:\s*0,[\s\S]*decisions:\s*0,[\s\S]*tasks:\s*0[\s\S]*\};/,
    );
    expect(source).toMatch(
      /const counts = \{[\s\S]*requirements:\s*0,[\s\S]*risks:\s*0,[\s\S]*integrations:\s*0,[\s\S]*decisions:\s*0,[\s\S]*tasks:\s*0[\s\S]*\};/,
    );
  });
});
