import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamPipelineTab } from "./WorkstreamPipelineTab";

const mockQueryResults: Record<string, any> = {};

vi.mock("convex/react", () => ({
  useQuery: (fn: string) => mockQueryResults[fn],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/test-program/workstreams/ws-1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    requirements: {
      pipelineStageCounts: "requirements:pipelineStageCounts",
      listWithPipelineContext: "requirements:listWithPipelineContext",
    },
  },
}));

vi.mock("../../../convex/shared/pipelineStage", () => ({
  PIPELINE_STAGES: ["discovery", "requirement", "implementation", "review"],
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery", shortLabel: "Disc" },
    requirement: { label: "Requirement", shortLabel: "Req" },
    implementation: { label: "Implementation", shortLabel: "Impl" },
    review: { label: "Review", shortLabel: "Rev" },
  },
}));

vi.mock("./PipelineEmptyState", () => ({
  PipelineEmptyState: () => <div>Empty State</div>,
}));
vi.mock("./PipelineRequirementCard", () => ({
  PipelineRequirementCard: ({ requirement, onClick }: any) => (
    <button onClick={onClick}>{requirement.title}</button>
  ),
}));
vi.mock("./PipelineStageFilter", () => ({
  PipelineStageFilter: () => <div>Stage Filter</div>,
}));
vi.mock("./PipelineStageSummary", () => ({
  PipelineStageSummary: () => <div>Stage Summary</div>,
}));
vi.mock("./RequirementPipelinePanel", () => ({
  RequirementPipelinePanel: () => <div>Pipeline Panel</div>,
}));

describe("WorkstreamPipelineTab", () => {
  const onCreateRequirement = vi.fn();

  it("shows empty state when total is 0", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = { total: 0, counts: {} };
    mockQueryResults["requirements:listWithPipelineContext"] = [];
    render(
      <WorkstreamPipelineTab
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onCreateRequirement={onCreateRequirement}
      />,
    );
    expect(screen.getByText("Empty State")).toBeInTheDocument();
  });

  it("shows loading skeletons when requirements are undefined", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = {
      total: 5,
      counts: { discovery: 5 },
    };
    mockQueryResults["requirements:listWithPipelineContext"] = undefined;
    const { container } = render(
      <WorkstreamPipelineTab
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onCreateRequirement={onCreateRequirement}
      />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBe(3);
  });

  it("renders stage summary and filter when data is available", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = {
      total: 5,
      counts: { discovery: 5 },
    };
    mockQueryResults["requirements:listWithPipelineContext"] = [
      { _id: "r1", title: "Auth Flow", refId: "REQ-001" },
    ];
    render(
      <WorkstreamPipelineTab
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onCreateRequirement={onCreateRequirement}
      />,
    );
    expect(screen.getByText("Stage Summary")).toBeInTheDocument();
    expect(screen.getByText("Stage Filter")).toBeInTheDocument();
  });

  it("renders requirement cards", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = {
      total: 2,
      counts: { discovery: 2 },
    };
    mockQueryResults["requirements:listWithPipelineContext"] = [
      { _id: "r1", title: "Auth Flow" },
      { _id: "r2", title: "Payment" },
    ];
    render(
      <WorkstreamPipelineTab
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onCreateRequirement={onCreateRequirement}
      />,
    );
    expect(screen.getByText("Auth Flow")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("shows no-match message when requirements is empty array", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = {
      total: 5,
      counts: { discovery: 5 },
    };
    mockQueryResults["requirements:listWithPipelineContext"] = [];
    render(
      <WorkstreamPipelineTab
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onCreateRequirement={onCreateRequirement}
      />,
    );
    expect(screen.getByText("No requirements match the current filters.")).toBeInTheDocument();
    expect(screen.getByText("Clear all filters")).toBeInTheDocument();
  });
});
