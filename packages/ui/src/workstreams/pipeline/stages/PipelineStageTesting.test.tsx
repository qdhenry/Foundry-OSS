import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageTesting } from "./PipelineStageTesting";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({ evidenceFiles: [] }),
}));

const baseProps = {
  requirement: { _id: "req-1", refId: "REQ-001", title: "Test" },
  programId: "prog-1",
  workstreamId: "ws-1",
};

describe("PipelineStageTesting", () => {
  it("renders heading", () => {
    render(<PipelineStageTesting {...baseProps} tasks={[]} />);
    expect(screen.getByText("Testing & Verification")).toBeInTheDocument();
  });

  it("shows task counts", () => {
    const tasks = [
      { _id: "t1", title: "T1", status: "review" },
      { _id: "t2", title: "T2", status: "done" },
      { _id: "t3", title: "T3", status: "in_progress" },
    ];
    render(<PipelineStageTesting {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Tasks in Review")).toBeInTheDocument();
    expect(screen.getByText("Tasks Completed")).toBeInTheDocument();
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
  });

  it("shows no evidence message when empty", () => {
    render(<PipelineStageTesting {...baseProps} tasks={[]} />);
    expect(screen.getByText(/No evidence uploaded yet/)).toBeInTheDocument();
  });

  it("renders tasks under review section", () => {
    const tasks = [{ _id: "t1", title: "Review This", status: "review" }];
    render(<PipelineStageTesting {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Tasks Under Review")).toBeInTheDocument();
    expect(screen.getByText("Review This")).toBeInTheDocument();
  });
});
