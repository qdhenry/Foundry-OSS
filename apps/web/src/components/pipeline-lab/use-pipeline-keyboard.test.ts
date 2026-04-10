import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePipelineKeyboard } from "./use-pipeline-keyboard";

const stages = [
  { id: "discovery" as const, label: "Discovery", shortLabel: "Disc", order: 0 },
  { id: "implementation" as const, label: "Implementation", shortLabel: "Impl", order: 4 },
];

const requirements = [
  {
    id: "req-1",
    refId: "BM-001",
    title: "Req 1",
    workstreamId: "ws-1",
    currentStage: "discovery" as const,
    health: "on_track" as const,
    priority: "must_have" as const,
    fitGap: "native" as const,
    effort: "low" as const,
    daysInStage: 1,
    stageHistory: [],
  },
];

describe("usePipelineKeyboard", () => {
  it("returns initial focused state", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: () => {},
        onOpen: () => {},
        onClose: () => {},
      }),
    );
    expect(result.current.focusedStageIndex).toBe(0);
    expect(result.current.focusedRequirementIndex).toBe(0);
  });

  it("returns focused requirement id for first stage", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: () => {},
        onOpen: () => {},
        onClose: () => {},
      }),
    );
    expect(result.current.focusedRequirementId).toBe("req-1");
  });

  it("returns null focusedRequirementId when no requirements in focused stage", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements: [],
        selectedId: null,
        onSelect: () => {},
        onOpen: () => {},
        onClose: () => {},
      }),
    );
    expect(result.current.focusedRequirementId).toBeNull();
  });
});
