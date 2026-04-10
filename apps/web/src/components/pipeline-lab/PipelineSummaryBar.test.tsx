import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PipelineSummaryBar } from "./PipelineSummaryBar";
import type { MockRequirement, PipelineStageConfig } from "./pipeline-types";

const mockStages: PipelineStageConfig[] = [
  { id: "discovery", label: "Discovery", shortLabel: "Disc", order: 0 },
  { id: "implementation", label: "Implementation", shortLabel: "Impl", order: 4 },
  { id: "deployed", label: "Deployed", shortLabel: "Deploy", order: 7 },
];

const baseReq: MockRequirement = {
  id: "req-1",
  refId: "REQ-001",
  title: "Test",
  workstreamId: "ws-1",
  currentStage: "discovery",
  health: "on_track",
  priority: "must_have",
  fitGap: "native",
  effort: "low",
  daysInStage: 1,
  stageHistory: [],
};

describe("PipelineSummaryBar", () => {
  it("renders completion percentage", () => {
    const reqs = [
      { ...baseReq, id: "r1", currentStage: "deployed" as const },
      { ...baseReq, id: "r2", currentStage: "discovery" as const },
    ];
    render(<PipelineSummaryBar requirements={reqs} stages={mockStages} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("deployed")).toBeInTheDocument();
  });

  it("shows 0% when no deployed requirements", () => {
    const reqs = [{ ...baseReq, id: "r1", currentStage: "discovery" as const }];
    render(<PipelineSummaryBar requirements={reqs} stages={mockStages} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows blocked count when requirements are blocked", () => {
    const reqs = [
      { ...baseReq, id: "r1", health: "blocked" as const },
      { ...baseReq, id: "r2", health: "on_track" as const },
    ];
    render(<PipelineSummaryBar requirements={reqs} stages={mockStages} />);
    expect(screen.getByText("1 blocked")).toBeInTheDocument();
  });

  it("does not show blocked section when none are blocked", () => {
    const reqs = [{ ...baseReq, id: "r1", health: "on_track" as const }];
    render(<PipelineSummaryBar requirements={reqs} stages={mockStages} />);
    expect(screen.queryByText(/blocked/)).not.toBeInTheDocument();
  });
});
