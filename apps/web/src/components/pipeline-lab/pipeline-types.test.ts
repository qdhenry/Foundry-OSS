import { describe, expect, it } from "vitest";
import type {
  Effort,
  FitGap,
  MockRequirement,
  MockWorkstream,
  PipelineStage,
  PipelineStageConfig,
  Priority,
  RequirementHealth,
  StageHistoryEntry,
} from "./pipeline-types";

describe("pipeline-types", () => {
  it("PipelineStage type accepts valid stages", () => {
    const stage: PipelineStage = "discovery";
    expect(stage).toBe("discovery");
  });

  it("PipelineStageConfig has required fields", () => {
    const config: PipelineStageConfig = {
      id: "implementation",
      label: "Implementation",
      shortLabel: "Impl",
      order: 4,
    };
    expect(config.id).toBe("implementation");
    expect(config.order).toBe(4);
  });

  it("MockRequirement has all required properties", () => {
    const req: MockRequirement = {
      id: "req-1",
      refId: "BM-001",
      title: "Test",
      workstreamId: "ws-1",
      currentStage: "discovery",
      health: "on_track",
      priority: "must_have",
      fitGap: "native",
      effort: "high",
      daysInStage: 3,
      stageHistory: [],
    };
    expect(req.id).toBe("req-1");
    expect(req.currentStage).toBe("discovery");
  });

  it("health, priority, fitGap, and effort types are valid", () => {
    const health: RequirementHealth = "at_risk";
    const priority: Priority = "should_have";
    const fitGap: FitGap = "custom_dev";
    const effort: Effort = "very_high";
    expect(health).toBe("at_risk");
    expect(priority).toBe("should_have");
    expect(fitGap).toBe("custom_dev");
    expect(effort).toBe("very_high");
  });

  it("StageHistoryEntry has stage and enteredAt", () => {
    const entry: StageHistoryEntry = {
      stage: "testing",
      enteredAt: "2026-01-01",
      exitedAt: "2026-01-02",
    };
    expect(entry.stage).toBe("testing");
    expect(entry.exitedAt).toBe("2026-01-02");
  });

  it("MockWorkstream type is defined", () => {
    const ws: MockWorkstream = {
      id: "ws-1",
      name: "Data Migration",
      shortCode: "DM",
      color: "#0ea5e9",
    };
    expect(ws.name).toBe("Data Migration");
  });
});
