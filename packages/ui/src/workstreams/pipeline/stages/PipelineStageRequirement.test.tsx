import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageRequirement } from "./PipelineStageRequirement";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

const baseProps = {
  requirement: {
    _id: "req-1",
    orgId: "org-1",
    refId: "REQ-001",
    title: "Test Requirement",
    description: "A description",
    priority: "must_have",
    fitGap: "native",
    effortEstimate: "medium",
    status: "draft",
  },
  programId: "prog-1",
  workstreamId: "ws-1",
  tasks: [] as any[],
};

describe("PipelineStageRequirement", () => {
  it("renders requirement details", () => {
    render(<PipelineStageRequirement {...baseProps} />);
    expect(screen.getByText("Requirement Details")).toBeInTheDocument();
    expect(screen.getByText("Test Requirement")).toBeInTheDocument();
    expect(screen.getByText("A description")).toBeInTheDocument();
  });

  it("shows draft banner with approve button", () => {
    render(<PipelineStageRequirement {...baseProps} />);
    expect(screen.getByText("This requirement is in draft")).toBeInTheDocument();
    expect(screen.getByText("Approve Requirement")).toBeInTheDocument();
  });

  it("shows approved banner with generate tasks button", () => {
    const props = {
      ...baseProps,
      requirement: { ...baseProps.requirement, status: "approved" },
    };
    render(<PipelineStageRequirement {...props} />);
    expect(screen.getByText("Requirement approved")).toBeInTheDocument();
    expect(screen.getByText("Generate Tasks")).toBeInTheDocument();
  });

  it("renders priority and fit/gap labels", () => {
    render(<PipelineStageRequirement {...baseProps} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Native")).toBeInTheDocument();
  });

  it("shows edit button", () => {
    render(<PipelineStageRequirement {...baseProps} />);
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });
});
