import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MockRequirement, MockWorkstream, PipelineStageConfig } from "./pipeline-types";
import { WorkstreamLine } from "./WorkstreamLine";

vi.mock("./RequirementDot", () => ({
  RequirementDot: ({ requirement, onClick }: any) => (
    <button data-testid={`dot-${requirement.id}`} onClick={onClick}>
      {requirement.refId}
    </button>
  ),
}));

vi.mock("./RequirementTooltip", () => ({
  RequirementTooltip: () => null,
}));

const stages: PipelineStageConfig[] = [
  { id: "discovery", label: "Discovery", shortLabel: "DISC", order: 0 },
  { id: "implementation", label: "Implementation", shortLabel: "IMPL", order: 1 },
];

const workstream: MockWorkstream = {
  id: "ws-1",
  name: "Catalog",
  shortCode: "CAT",
  color: "#3b82f6",
  requirements: ["r1", "r2"],
};

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
    refId: "CAT-002",
    title: "Categories",
    workstreamId: "ws-1",
    currentStage: "implementation",
    health: "at_risk",
    priority: "should_have",
    fitGap: "custom_dev",
    effort: "high",
    daysInStage: 3,
    stageHistory: [{ stage: "implementation", enteredAt: "2026-01-05" }],
  },
];

describe("WorkstreamLine", () => {
  it("renders workstream name and short code", () => {
    render(
      <WorkstreamLine
        workstream={workstream}
        requirements={requirements}
        stages={stages}
        selectedId={null}
        dimmed={false}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        highlightedStage={null}
      />,
    );
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("CAT")).toBeInTheDocument();
  });

  it("renders requirement dots for each stage", () => {
    render(
      <WorkstreamLine
        workstream={workstream}
        requirements={requirements}
        stages={stages}
        selectedId={null}
        dimmed={false}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        highlightedStage={null}
      />,
    );
    expect(screen.getByTestId("dot-r1")).toBeInTheDocument();
    expect(screen.getByTestId("dot-r2")).toBeInTheDocument();
  });

  it("calls onSelectRequirement when dot clicked", async () => {
    const onSelect = vi.fn();
    const { getByTestId } = render(
      <WorkstreamLine
        workstream={workstream}
        requirements={requirements}
        stages={stages}
        selectedId={null}
        dimmed={false}
        onSelectRequirement={onSelect}
        onHoverRequirement={vi.fn()}
        highlightedStage={null}
      />,
    );
    getByTestId("dot-r1").click();
    expect(onSelect).toHaveBeenCalledWith("r1");
  });

  it("renders with empty requirements", () => {
    render(
      <WorkstreamLine
        workstream={workstream}
        requirements={[]}
        stages={stages}
        selectedId={null}
        dimmed={false}
        onSelectRequirement={vi.fn()}
        onHoverRequirement={vi.fn()}
        highlightedStage={null}
      />,
    );
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.queryByTestId("dot-r1")).not.toBeInTheDocument();
  });
});
