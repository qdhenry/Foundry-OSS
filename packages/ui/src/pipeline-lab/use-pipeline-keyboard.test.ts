import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MockRequirement, PipelineStageConfig } from "./pipeline-types";
import { usePipelineKeyboard } from "./use-pipeline-keyboard";

const stages: PipelineStageConfig[] = [
  { id: "discovery", label: "Discovery", shortLabel: "DISC", order: 0 },
  { id: "gap_analysis", label: "Gap Analysis", shortLabel: "GAP", order: 1 },
  { id: "implementation", label: "Implementation", shortLabel: "IMPL", order: 2 },
];

const requirements: MockRequirement[] = [
  {
    id: "req-1",
    refId: "R1",
    title: "Req 1",
    workstreamId: "ws-1",
    currentStage: "discovery",
    health: "on_track",
    priority: "must_have",
    fitGap: "native",
    effort: "low",
    daysInStage: 1,
    stageHistory: [{ stage: "discovery", enteredAt: "2026-01-01" }],
  },
  {
    id: "req-2",
    refId: "R2",
    title: "Req 2",
    workstreamId: "ws-1",
    currentStage: "discovery",
    health: "on_track",
    priority: "should_have",
    fitGap: "config",
    effort: "medium",
    daysInStage: 2,
    stageHistory: [{ stage: "discovery", enteredAt: "2026-01-02" }],
  },
  {
    id: "req-3",
    refId: "R3",
    title: "Req 3",
    workstreamId: "ws-1",
    currentStage: "gap_analysis",
    health: "at_risk",
    priority: "must_have",
    fitGap: "custom_dev",
    effort: "high",
    daysInStage: 3,
    stageHistory: [{ stage: "gap_analysis", enteredAt: "2026-01-03" }],
  },
];

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

describe("usePipelineKeyboard", () => {
  it("starts with focusedStageIndex 0", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    expect(result.current.focusedStageIndex).toBe(0);
    expect(result.current.focusedRequirementIndex).toBe(0);
  });

  it("moves right on ArrowRight", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    act(() => fireKey("ArrowRight"));
    expect(result.current.focusedStageIndex).toBe(1);
  });

  it("does not exceed stage bounds on ArrowRight", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    act(() => fireKey("ArrowRight"));
    act(() => fireKey("ArrowRight"));
    act(() => fireKey("ArrowRight"));
    expect(result.current.focusedStageIndex).toBe(2);
  });

  it("moves left on ArrowLeft", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    act(() => fireKey("ArrowRight"));
    act(() => fireKey("ArrowLeft"));
    expect(result.current.focusedStageIndex).toBe(0);
  });

  it("does not go below 0 on ArrowLeft", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    act(() => fireKey("ArrowLeft"));
    expect(result.current.focusedStageIndex).toBe(0);
  });

  it("moves down through requirements in a stage", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    // Stage 0 (discovery) has 2 requirements
    act(() => fireKey("ArrowDown"));
    expect(result.current.focusedRequirementIndex).toBe(1);
    expect(result.current.focusedRequirementId).toBe("req-2");
  });

  it("calls onSelect and onOpen on Enter", () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect,
        onOpen,
        onClose: vi.fn(),
      }),
    );
    act(() => fireKey("Enter"));
    expect(onSelect).toHaveBeenCalledWith("req-1");
    expect(onOpen).toHaveBeenCalledWith("req-1");
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose,
      }),
    );
    act(() => fireKey("Escape"));
    expect(onClose).toHaveBeenCalled();
  });

  it("resets requirement index when changing stages", () => {
    const { result } = renderHook(() =>
      usePipelineKeyboard({
        stages,
        requirements,
        selectedId: null,
        onSelect: vi.fn(),
        onOpen: vi.fn(),
        onClose: vi.fn(),
      }),
    );
    act(() => fireKey("ArrowDown")); // req index = 1
    act(() => fireKey("ArrowRight")); // move to gap_analysis, resets req index
    expect(result.current.focusedRequirementIndex).toBe(0);
    expect(result.current.focusedStageIndex).toBe(1);
  });
});
