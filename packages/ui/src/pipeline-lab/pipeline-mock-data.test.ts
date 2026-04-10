import { describe, expect, it } from "vitest";
import {
  getRequirementsByStage,
  getRequirementsByWorkstream,
  getStageCount,
  MOCK_REQUIREMENTS,
  MOCK_WORKSTREAMS,
  PIPELINE_STAGES,
} from "./pipeline-mock-data";

describe("pipeline-mock-data", () => {
  it("exports 8 pipeline stages", () => {
    expect(PIPELINE_STAGES).toHaveLength(8);
    expect(PIPELINE_STAGES[0].id).toBe("discovery");
    expect(PIPELINE_STAGES[7].id).toBe("deployed");
  });

  it("exports 3 mock workstreams", () => {
    expect(MOCK_WORKSTREAMS).toHaveLength(3);
    expect(MOCK_WORKSTREAMS.map((w) => w.shortCode)).toEqual(["CAT", "CHK", "ORD"]);
  });

  it("exports all mock requirements", () => {
    expect(MOCK_REQUIREMENTS.length).toBeGreaterThanOrEqual(17);
  });

  it("getRequirementsByStage returns correct count for discovery", () => {
    const discovery = getRequirementsByStage("discovery");
    expect(discovery.length).toBe(2);
    expect(discovery.every((r) => r.currentStage === "discovery")).toBe(true);
  });

  it("getRequirementsByStage returns correct count for sprint_planning", () => {
    const planning = getRequirementsByStage("sprint_planning");
    expect(planning.length).toBe(4);
  });

  it("getRequirementsByStage returns correct count for deployed", () => {
    const deployed = getRequirementsByStage("deployed");
    expect(deployed.length).toBe(2);
  });

  it("getRequirementsByWorkstream returns correct items", () => {
    const catalog = getRequirementsByWorkstream("ws-catalog");
    expect(catalog.length).toBe(6);
    expect(catalog.every((r) => r.workstreamId === "ws-catalog")).toBe(true);
  });

  it("getStageCount returns number for implementation", () => {
    const count = getStageCount("implementation");
    expect(count).toBe(3);
  });

  it("all requirements have valid stage IDs", () => {
    const stageIds = new Set(PIPELINE_STAGES.map((s) => s.id));
    for (const req of MOCK_REQUIREMENTS) {
      expect(stageIds.has(req.currentStage)).toBe(true);
    }
  });

  it("all requirements have valid workstream IDs", () => {
    const wsIds = new Set(MOCK_WORKSTREAMS.map((w) => w.id));
    for (const req of MOCK_REQUIREMENTS) {
      expect(wsIds.has(req.workstreamId)).toBe(true);
    }
  });

  it("stages have sequential order values", () => {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      expect(PIPELINE_STAGES[i].order).toBe(i);
    }
  });
});
