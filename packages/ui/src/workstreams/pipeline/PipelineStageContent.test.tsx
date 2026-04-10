import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageContent } from "./PipelineStageContent";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../programs", () => ({
  useProgramContext: () => ({ slug: "test-prog" }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => null,
  useMutation: () => vi.fn(),
}));

vi.mock("./stages/PipelineStageDiscovery", () => ({
  PipelineStageDiscovery: () => <div data-testid="stage-discovery">Discovery</div>,
}));

vi.mock("./stages/PipelineStageRequirement", () => ({
  PipelineStageRequirement: () => <div data-testid="stage-requirement">Requirement</div>,
}));

vi.mock("./stages/PipelineStageSprint", () => ({
  PipelineStageSprint: () => <div data-testid="stage-sprint">Sprint</div>,
}));

vi.mock("./stages/PipelineStageTaskGen", () => ({
  PipelineStageTaskGen: () => <div data-testid="stage-taskgen">TaskGen</div>,
}));

vi.mock("./stages/PipelineStageSubtaskGen", () => ({
  PipelineStageSubtaskGen: () => <div data-testid="stage-subtaskgen">SubtaskGen</div>,
}));

vi.mock("./stages/PipelineStageImplementation", () => ({
  PipelineStageImplementation: () => <div data-testid="stage-impl">Implementation</div>,
}));

vi.mock("./stages/PipelineStageTesting", () => ({
  PipelineStageTesting: () => <div data-testid="stage-testing">Testing</div>,
}));

vi.mock("./stages/PipelineStageReview", () => ({
  PipelineStageReview: () => <div data-testid="stage-review">Review</div>,
}));

const baseProps = {
  requirement: {
    _id: "req-1",
    orgId: "org-1",
    refId: "REQ-001",
    title: "Test",
    priority: "must_have",
    fitGap: "native",
    status: "draft",
  },
  programId: "prog-1",
  workstreamId: "ws-1",
  tasks: [] as any[],
};

describe("PipelineStageContent", () => {
  it("renders discovery stage", () => {
    render(<PipelineStageContent {...baseProps} stage="discovery" />);
    expect(screen.getByTestId("stage-discovery")).toBeInTheDocument();
  });

  it("renders requirement stage", () => {
    render(<PipelineStageContent {...baseProps} stage="requirement" />);
    expect(screen.getByTestId("stage-requirement")).toBeInTheDocument();
  });

  it("renders implementation stage", () => {
    render(<PipelineStageContent {...baseProps} stage="implementation" />);
    expect(screen.getByTestId("stage-impl")).toBeInTheDocument();
  });

  it("renders review stage", () => {
    render(<PipelineStageContent {...baseProps} stage="review" />);
    expect(screen.getByTestId("stage-review")).toBeInTheDocument();
  });

  it("renders unknown stage fallback", () => {
    render(<PipelineStageContent {...baseProps} stage={"unknown" as any} />);
    expect(screen.getByText("Unknown pipeline stage.")).toBeInTheDocument();
  });
});
