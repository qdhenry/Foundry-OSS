import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineMetroMap } from "./PipelineMetroMap";

vi.mock("./StationHeader", () => ({
  StationHeader: ({ stage, count }: any) => (
    <div data-testid={`station-${stage.id}`}>
      {stage.shortLabel} ({count})
    </div>
  ),
}));

vi.mock("./WorkstreamLine", () => ({
  WorkstreamLine: ({ workstream }: any) => (
    <div data-testid={`workstream-${workstream.id}`}>{workstream.name}</div>
  ),
}));

const stages = [
  { id: "discovery" as const, label: "Discovery", shortLabel: "Disc", order: 0 },
  { id: "implementation" as const, label: "Implementation", shortLabel: "Impl", order: 4 },
];

const workstreams = [
  { id: "ws-1", name: "Data Migration", shortCode: "DM", color: "#0ea5e9" },
  { id: "ws-2", name: "Frontend", shortCode: "FE", color: "#10b981" },
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

describe("PipelineMetroMap", () => {
  it("renders station headers for each stage", () => {
    render(
      <PipelineMetroMap
        requirements={requirements}
        workstreams={workstreams}
        stages={stages}
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

  it("renders workstream lines", () => {
    render(
      <PipelineMetroMap
        requirements={requirements}
        workstreams={workstreams}
        stages={stages}
        selectedId={null}
        activeWorkstreamFilter={null}
        highlightedStage={null}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        onHighlightStage={vi.fn()}
      />,
    );
    expect(screen.getByTestId("workstream-ws-1")).toBeInTheDocument();
    expect(screen.getByTestId("workstream-ws-2")).toBeInTheDocument();
  });

  it("counts requirements per stage", () => {
    render(
      <PipelineMetroMap
        requirements={requirements}
        workstreams={workstreams}
        stages={stages}
        selectedId={null}
        activeWorkstreamFilter={null}
        highlightedStage={null}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        onHighlightStage={vi.fn()}
      />,
    );
    expect(screen.getByText("Disc (1)")).toBeInTheDocument();
    expect(screen.getByText("Impl (0)")).toBeInTheDocument();
  });
});
