import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageTesting } from "./PipelineStageTesting";

vi.mock("convex/react", () => ({
  useQuery: () => ({ evidenceFiles: [] }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    requirements: { get: "requirements:get" },
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseProps = {
  requirement: { _id: "req-1", refId: "BM-001", title: "Test Req" },
  programId: "prog-1" as any,
  workstreamId: "ws-1" as any,
};

describe("PipelineStageTesting", () => {
  it("renders Testing & Verification heading", () => {
    render(<PipelineStageTesting {...baseProps} tasks={[]} />);
    expect(screen.getByText("Testing & Verification")).toBeInTheDocument();
  });

  it("shows task counts for review and completed", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "review" },
      { _id: "t2", title: "Task 2", status: "done" },
      { _id: "t3", title: "Task 3", status: "review" },
    ];
    render(<PipelineStageTesting {...baseProps} tasks={tasks} />);
    // Check label+value pairs instead of standalone numbers
    expect(screen.getByText("Tasks in Review")).toBeInTheDocument();
    expect(screen.getByText("Tasks Completed")).toBeInTheDocument();
    expect(screen.getByText("Total Tasks")).toBeInTheDocument();
  });

  it("shows no evidence message when empty", () => {
    render(<PipelineStageTesting {...baseProps} tasks={[]} />);
    expect(screen.getByText(/No evidence uploaded yet/)).toBeInTheDocument();
  });

  it("shows evidence heading with count", () => {
    render(<PipelineStageTesting {...baseProps} tasks={[]} />);
    expect(screen.getByText("Evidence (0)")).toBeInTheDocument();
  });

  it("shows tasks under review section when tasks in review", () => {
    const tasks = [{ _id: "t1", title: "Build settings page", status: "review" }];
    render(<PipelineStageTesting {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Tasks Under Review")).toBeInTheDocument();
    expect(screen.getByText("Build settings page")).toBeInTheDocument();
  });

  it("shows next step to verify tasks in review", () => {
    const tasks = [{ _id: "t1", title: "Task 1", status: "review" }];
    render(<PipelineStageTesting {...baseProps} tasks={tasks} />);
    expect(screen.getByText(/1 task in review/)).toBeInTheDocument();
  });

  it("shows next step to upload evidence", () => {
    render(<PipelineStageTesting {...baseProps} tasks={[]} />);
    expect(screen.getByText("Upload verification evidence")).toBeInTheDocument();
  });
});
