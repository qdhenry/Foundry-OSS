import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamLine } from "./WorkstreamLine";

vi.mock("./RequirementDot", () => ({
  RequirementDot: ({ requirement }: any) => (
    <div data-testid={`dot-${requirement.id}`}>{requirement.refId}</div>
  ),
}));

vi.mock("./RequirementTooltip", () => ({
  RequirementTooltip: ({ requirement }: any) => (
    <div data-testid="tooltip">{requirement?.refId}</div>
  ),
}));

const stages = [
  { id: "discovery" as const, label: "Discovery", shortLabel: "Disc", order: 0 },
  { id: "implementation" as const, label: "Implementation", shortLabel: "Impl", order: 4 },
];

const workstream = { id: "ws-1", name: "Data Migration", shortCode: "DM", color: "#0ea5e9" };

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

describe("WorkstreamLine", () => {
  it("renders workstream name", () => {
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
    expect(screen.getByText("Data Migration")).toBeInTheDocument();
  });

  it("renders short code badge", () => {
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
    expect(screen.getByText("DM")).toBeInTheDocument();
  });

  it("renders requirement dots", () => {
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
    expect(screen.getByTestId("dot-req-1")).toBeInTheDocument();
  });
});
