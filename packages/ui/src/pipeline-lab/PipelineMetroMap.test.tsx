import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineMetroMap } from "./PipelineMetroMap";
import type { MockRequirement, MockWorkstream, PipelineStageConfig } from "./pipeline-types";

vi.mock("../theme/useAnimations", () => ({
  useStaggerEntrance: vi.fn(),
}));

vi.mock("./StationHeader", () => ({
  StationHeader: ({ stage, count }: any) => (
    <div data-testid={`station-${stage.id}`}>
      {stage.shortLabel} ({count})
    </div>
  ),
}));

vi.mock("./WorkstreamLine", () => ({
  WorkstreamLine: ({ workstream }: any) => (
    <div data-testid={`ws-${workstream.id}`}>{workstream.name}</div>
  ),
}));

const stages: PipelineStageConfig[] = [
  { id: "discovery", label: "Discovery", shortLabel: "DISC", order: 0 },
  { id: "implementation", label: "Implementation", shortLabel: "IMPL", order: 1 },
];

const workstreams: MockWorkstream[] = [
  { id: "ws-1", name: "Catalog", shortCode: "CAT", color: "#3b82f6", requirements: ["r1"] },
  { id: "ws-2", name: "Checkout", shortCode: "CHK", color: "#10b981", requirements: ["r2"] },
];

const requirements: MockRequirement[] = [
  {
    id: "r1",
    refId: "CAT-001",
    title: "Mapping",
    workstreamId: "ws-1",
    currentStage: "discovery",
    health: "on_track",
    priority: "must_have",
    fitGap: "config",
    effort: "low",
    daysInStage: 1,
    stageHistory: [{ stage: "discovery", enteredAt: "2026-01-01" }],
  },
  {
    id: "r2",
    refId: "CHK-001",
    title: "Payment",
    workstreamId: "ws-2",
    currentStage: "implementation",
    health: "at_risk",
    priority: "must_have",
    fitGap: "custom_dev",
    effort: "high",
    daysInStage: 5,
    stageHistory: [{ stage: "implementation", enteredAt: "2026-01-10" }],
  },
];

describe("PipelineMetroMap", () => {
  it("renders station headers for each stage", () => {
    render(
      <PipelineMetroMap
        requirements={requirements}
        stages={stages}
        workstreams={workstreams}
        selectedId={null}
        activeWorkstreamFilter={null}
        highlightedStage={null}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        onHighlightStage={vi.fn()}
      />,
    );
    expect(screen.getByTestId("station-discovery")).toBeInTheDocument();
    expect(screen.getByTestId("station-implementation")).toBeInTheDocument();
  });

  it("renders station headers with correct counts", () => {
    render(
      <PipelineMetroMap
        requirements={requirements}
        stages={stages}
        workstreams={workstreams}
        selectedId={null}
        activeWorkstreamFilter={null}
        highlightedStage={null}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        onHighlightStage={vi.fn()}
      />,
    );
    expect(screen.getByText("DISC (1)")).toBeInTheDocument();
    expect(screen.getByText("IMPL (1)")).toBeInTheDocument();
  });

  it("renders workstream lines", () => {
    render(
      <PipelineMetroMap
        requirements={requirements}
        stages={stages}
        workstreams={workstreams}
        selectedId={null}
        activeWorkstreamFilter={null}
        highlightedStage={null}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        onHighlightStage={vi.fn()}
      />,
    );
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Checkout")).toBeInTheDocument();
  });

  it("renders with empty requirements", () => {
    render(
      <PipelineMetroMap
        requirements={[]}
        stages={stages}
        workstreams={workstreams}
        selectedId={null}
        activeWorkstreamFilter={null}
        highlightedStage={null}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        onHighlightStage={vi.fn()}
      />,
    );
    expect(screen.getByText("DISC (0)")).toBeInTheDocument();
    expect(screen.getByText("IMPL (0)")).toBeInTheDocument();
  });
});
