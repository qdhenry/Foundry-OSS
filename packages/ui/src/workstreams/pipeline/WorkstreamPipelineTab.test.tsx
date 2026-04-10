import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamPipelineTab } from "./WorkstreamPipelineTab";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/test-prog/workstreams/ws-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./PipelineEmptyState", () => ({
  PipelineEmptyState: () => <div data-testid="empty-state">EmptyState</div>,
}));

vi.mock("./PipelineRequirementCard", () => ({
  PipelineRequirementCard: () => <div>ReqCard</div>,
}));

vi.mock("./PipelineStageFilter", () => ({
  PipelineStageFilter: () => <div data-testid="filter">Filter</div>,
}));

vi.mock("./PipelineStageSummary", () => ({
  PipelineStageSummary: () => <div data-testid="summary">Summary</div>,
}));

vi.mock("./RequirementPipelinePanel", () => ({
  RequirementPipelinePanel: () => <div>PipelinePanel</div>,
}));

let queryReturnValue: any;
vi.mock("convex/react", () => ({
  useQuery: () => queryReturnValue,
}));

const baseProps = {
  programId: "prog-1",
  workstreamId: "ws-1",
  onCreateRequirement: vi.fn(),
};

describe("WorkstreamPipelineTab", () => {
  it("shows empty state when total is 0", () => {
    queryReturnValue = { total: 0, counts: {} };
    render(<WorkstreamPipelineTab {...baseProps} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
  });

  it("shows loading skeletons when requirements undefined", () => {
    queryReturnValue = undefined;
    const { container } = render(<WorkstreamPipelineTab {...baseProps} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });
});
