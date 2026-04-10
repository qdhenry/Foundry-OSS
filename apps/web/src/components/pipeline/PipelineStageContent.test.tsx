import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageContent } from "./PipelineStageContent";

vi.mock("./stages/PipelineStageDiscovery", () => ({
  PipelineStageDiscovery: () => <div>Discovery Stage Content</div>,
}));
vi.mock("./stages/PipelineStageRequirement", () => ({
  PipelineStageRequirement: () => <div>Requirement Stage Content</div>,
}));
vi.mock("./stages/PipelineStageSprint", () => ({
  PipelineStageSprint: () => <div>Sprint Stage Content</div>,
}));
vi.mock("./stages/PipelineStageTaskGen", () => ({
  PipelineStageTaskGen: () => <div>TaskGen Stage Content</div>,
}));
vi.mock("./stages/PipelineStageSubtaskGen", () => ({
  PipelineStageSubtaskGen: () => <div>SubtaskGen Stage Content</div>,
}));
vi.mock("./stages/PipelineStageImplementation", () => ({
  PipelineStageImplementation: () => <div>Implementation Stage Content</div>,
}));
vi.mock("./stages/PipelineStageTesting", () => ({
  PipelineStageTesting: () => <div>Testing Stage Content</div>,
}));
vi.mock("./stages/PipelineStageReview", () => ({
  PipelineStageReview: () => <div>Review Stage Content</div>,
}));

const baseProps = {
  requirement: {
    _id: "r1",
    orgId: "org-1",
    refId: "REQ-001",
    title: "Test Req",
    priority: "must_have",
    fitGap: "native",
    status: "active",
  },
  programId: "prog-1" as any,
  workstreamId: "ws-1" as any,
  tasks: [],
  finding: null,
};

describe("PipelineStageContent", () => {
  it("renders discovery stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"discovery" as any} />);
    expect(screen.getByText("Discovery Stage Content")).toBeInTheDocument();
  });

  it("renders requirement stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"requirement" as any} />);
    expect(screen.getByText("Requirement Stage Content")).toBeInTheDocument();
  });

  it("renders sprint_planning stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"sprint_planning" as any} />);
    expect(screen.getByText("Sprint Stage Content")).toBeInTheDocument();
  });

  it("renders task_generation stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"task_generation" as any} />);
    expect(screen.getByText("TaskGen Stage Content")).toBeInTheDocument();
  });

  it("renders subtask_generation stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"subtask_generation" as any} />);
    expect(screen.getByText("SubtaskGen Stage Content")).toBeInTheDocument();
  });

  it("renders implementation stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"implementation" as any} />);
    expect(screen.getByText("Implementation Stage Content")).toBeInTheDocument();
  });

  it("renders testing stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"testing" as any} />);
    expect(screen.getByText("Testing Stage Content")).toBeInTheDocument();
  });

  it("renders review stage", () => {
    render(<PipelineStageContent {...baseProps} stage={"review" as any} />);
    expect(screen.getByText("Review Stage Content")).toBeInTheDocument();
  });

  it("renders unknown stage fallback", () => {
    render(<PipelineStageContent {...baseProps} stage={"unknown_stage" as any} />);
    expect(screen.getByText("Unknown pipeline stage.")).toBeInTheDocument();
  });
});
