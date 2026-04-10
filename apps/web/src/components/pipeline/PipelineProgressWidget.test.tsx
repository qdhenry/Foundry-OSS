import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineProgressWidget } from "./PipelineProgressWidget";

const mockQueryResults: Record<string, any> = {};

vi.mock("convex/react", () => ({
  useQuery: (fn: string) => mockQueryResults[fn],
}));

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    requirements: {
      pipelineStageCounts: "requirements:pipelineStageCounts",
    },
    workstreams: {
      listByProgram: "workstreams:listByProgram",
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

describe("PipelineProgressWidget", () => {
  it("shows loading skeleton when data is undefined", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = undefined;
    mockQueryResults["workstreams:listByProgram"] = undefined;
    const { container } = render(<PipelineProgressWidget programId={"prog-1" as any} />);
    expect(screen.getByText("Pipeline Progress")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows empty state when total is 0", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = { total: 0, counts: {}, progress: 0 };
    mockQueryResults["workstreams:listByProgram"] = [];
    render(<PipelineProgressWidget programId={"prog-1" as any} />);
    expect(screen.getByText("No requirements in the pipeline yet.")).toBeInTheDocument();
  });

  it("renders progress percentage", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = {
      total: 10,
      counts: { discovery: 3, implementation: 5, review: 2 },
      progress: 45,
    };
    mockQueryResults["workstreams:listByProgram"] = [];
    render(<PipelineProgressWidget programId={"prog-1" as any} />);
    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("renders stage legend with counts", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = {
      total: 8,
      counts: { discovery: 3, implementation: 5 },
      progress: 30,
    };
    mockQueryResults["workstreams:listByProgram"] = [];
    render(<PipelineProgressWidget programId={"prog-1" as any} />);
    expect(screen.getByText("Disc (3)")).toBeInTheDocument();
    expect(screen.getByText("Impl (5)")).toBeInTheDocument();
  });

  it("renders workstream mini progress when workstreams exist", () => {
    mockQueryResults["requirements:pipelineStageCounts"] = {
      total: 10,
      counts: { discovery: 5, implementation: 5 },
      progress: 50,
    };
    mockQueryResults["workstreams:listByProgram"] = [
      { _id: "ws-1", name: "Frontend", shortCode: "FE" },
    ];
    render(<PipelineProgressWidget programId={"prog-1" as any} />);
    expect(screen.getByText("By Workstream")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
  });
});
