import { describe, expect, it } from "vitest";
import { PIPELINE_STAGE_CONFIG, PIPELINE_STAGE_ORDER, PIPELINE_STAGES } from "./pipelineStage";

describe("pipelineStage constants", () => {
  it("exports 8 pipeline stages", () => {
    expect(PIPELINE_STAGES).toHaveLength(8);
    expect(PIPELINE_STAGES).toContain("discovery");
    expect(PIPELINE_STAGES).toContain("review");
  });

  it("PIPELINE_STAGE_ORDER maps each stage to a sequential number", () => {
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      expect(PIPELINE_STAGE_ORDER[PIPELINE_STAGES[i]]).toBe(i);
    }
  });

  it("PIPELINE_STAGE_CONFIG has label, shortLabel, and order for every stage", () => {
    for (const stage of PIPELINE_STAGES) {
      const config = PIPELINE_STAGE_CONFIG[stage];
      expect(config.label).toBeTruthy();
      expect(config.shortLabel).toBeTruthy();
      expect(typeof config.order).toBe("number");
    }
  });

  it("config order matches PIPELINE_STAGE_ORDER", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(PIPELINE_STAGE_CONFIG[stage].order).toBe(PIPELINE_STAGE_ORDER[stage]);
    }
  });
});
