import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineLabPage } from "./PipelineLabPage";

vi.mock("./PipelineDetailPanel", () => ({
  PipelineDetailPanel: ({ onClose }: any) => (
    <div>
      Detail Panel <button onClick={onClose}>Close Panel</button>
    </div>
  ),
}));

vi.mock("./PipelineMetroMap", () => ({
  PipelineMetroMap: ({ onSelectRequirement }: any) => (
    <div>
      Metro Map <button onClick={() => onSelectRequirement("req-cat-001")}>Select Req</button>
    </div>
  ),
}));

vi.mock("./PipelineSummaryBar", () => ({
  PipelineSummaryBar: () => <div>Summary Bar</div>,
}));

vi.mock("./WorkstreamFilterTabs", () => ({
  WorkstreamFilterTabs: ({ onFilterChange }: any) => (
    <div>
      Filter Tabs <button onClick={() => onFilterChange("ws-catalog")}>Filter Catalog</button>
    </div>
  ),
}));

vi.mock("./use-pipeline-keyboard", () => ({
  usePipelineKeyboard: () => ({
    focusedStageIndex: 0,
    focusedRequirementIndex: 0,
    focusedRequirementId: null,
  }),
}));

vi.mock("./pipeline-mock-data", () => ({
  PIPELINE_STAGES: [
    { id: "discovery", label: "Discovery", shortLabel: "DISC", order: 0 },
    { id: "implementation", label: "Implementation", shortLabel: "IMPL", order: 1 },
  ],
  MOCK_WORKSTREAMS: [
    { id: "ws-catalog", name: "Catalog", shortCode: "CAT", color: "#3b82f6", requirements: [] },
  ],
  MOCK_REQUIREMENTS: [
    {
      id: "req-cat-001",
      refId: "CAT-001",
      title: "Product mapping",
      workstreamId: "ws-catalog",
      currentStage: "discovery",
      health: "on_track",
      priority: "must_have",
      fitGap: "config",
      effort: "medium",
      daysInStage: 3,
      stageHistory: [{ stage: "discovery", enteredAt: "2026-01-10" }],
    },
  ],
}));

describe("PipelineLabPage", () => {
  it("renders heading and description", () => {
    render(<PipelineLabPage programId="prog-1" programSlug="test" />);
    expect(screen.getByText("Pipeline Lab")).toBeInTheDocument();
    expect(
      screen.getByText(/Track requirements through the migration pipeline/),
    ).toBeInTheDocument();
  });

  it("renders metro map", () => {
    render(<PipelineLabPage programId="prog-1" programSlug="test" />);
    expect(screen.getByText("Metro Map")).toBeInTheDocument();
  });

  it("renders summary bar", () => {
    render(<PipelineLabPage programId="prog-1" programSlug="test" />);
    expect(screen.getByText("Summary Bar")).toBeInTheDocument();
  });

  it("renders filter tabs", () => {
    render(<PipelineLabPage programId="prog-1" programSlug="test" />);
    expect(screen.getByText("Filter Tabs")).toBeInTheDocument();
  });

  it("renders legend items", () => {
    render(<PipelineLabPage programId="prog-1" programSlug="test" />);
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Deployed")).toBeInTheDocument();
  });

  it("opens detail panel when requirement selected", async () => {
    const user = userEvent.setup();
    render(<PipelineLabPage programId="prog-1" programSlug="test" />);
    await user.click(screen.getByText("Select Req"));
    expect(screen.getByText("Detail Panel")).toBeInTheDocument();
  });

  it("closes detail panel on close", async () => {
    const user = userEvent.setup();
    render(<PipelineLabPage programId="prog-1" programSlug="test" />);
    await user.click(screen.getByText("Select Req"));
    expect(screen.getByText("Detail Panel")).toBeInTheDocument();
    await user.click(screen.getByText("Close Panel"));
    expect(screen.queryByText("Detail Panel")).not.toBeInTheDocument();
  });
});
