import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageReview } from "./PipelineStageReview";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

const baseProps = {
  requirement: {
    _id: "req-1",
    refId: "REQ-001",
    title: "Test",
    priority: "must_have",
    fitGap: "native",
    status: "in_progress",
  },
  programId: "prog-1",
  workstreamId: "ws-1",
};

describe("PipelineStageReview", () => {
  it("renders final review heading", () => {
    render(<PipelineStageReview {...baseProps} tasks={[]} />);
    expect(screen.getByText("Final Review")).toBeInTheDocument();
  });

  it("shows task counts", () => {
    const tasks = [
      { _id: "t1", title: "T1", status: "done" },
      { _id: "t2", title: "T2", status: "done" },
    ];
    render(<PipelineStageReview {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
    expect(screen.getByText("Tasks Completed")).toBeInTheDocument();
  });

  it("shows approve button when all tasks done and not complete", () => {
    const tasks = [{ _id: "t1", title: "T1", status: "done" }];
    render(<PipelineStageReview {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Approve & Mark Complete")).toBeInTheDocument();
  });

  it("shows completion message when requirement is complete", () => {
    const props = {
      ...baseProps,
      requirement: { ...baseProps.requirement, status: "complete" },
    };
    const tasks = [{ _id: "t1", title: "T1", status: "done" }];
    render(<PipelineStageReview {...props} tasks={tasks} />);
    expect(screen.getByText(/completed and approved/)).toBeInTheDocument();
  });

  it("shows pending approval status when not complete", () => {
    render(<PipelineStageReview {...baseProps} tasks={[]} />);
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
  });
});
