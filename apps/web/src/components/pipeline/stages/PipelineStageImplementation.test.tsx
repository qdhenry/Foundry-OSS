import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageImplementation } from "./PipelineStageImplementation";

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({
    program: { _id: "prog-1", name: "Test" },
    programId: "prog-1",
    slug: "test-program",
  }),
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

describe("PipelineStageImplementation", () => {
  it("renders implementation progress heading", () => {
    render(<PipelineStageImplementation {...baseProps} tasks={[]} />);
    expect(screen.getByText("Implementation Progress")).toBeInTheDocument();
  });

  it("shows 0% progress when no tasks", () => {
    render(<PipelineStageImplementation {...baseProps} tasks={[]} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 of 0 tasks complete")).toBeInTheDocument();
  });

  it("calculates progress percentage correctly", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "done", priority: "high" },
      { _id: "t2", title: "Task 2", status: "in_progress", priority: "high" },
      { _id: "t3", title: "Task 3", status: "todo", priority: "medium" },
      { _id: "t4", title: "Task 4", status: "done", priority: "low" },
    ];
    render(<PipelineStageImplementation {...baseProps} tasks={tasks} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2 of 4 tasks complete")).toBeInTheDocument();
  });

  it("renders task list with assignees and titles", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Build settings page",
        status: "in_progress",
        priority: "high",
        assigneeName: "Alice",
      },
      { _id: "t2", title: "Order API", status: "done", priority: "high" },
    ];
    render(<PipelineStageImplementation {...baseProps} tasks={tasks} />);
    // Task titles may appear in multiple places (list + next steps description)
    expect(screen.getAllByText("Build settings page").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Order API")).toBeInTheDocument();
  });

  it("shows status summary counts", () => {
    const tasks = [
      { _id: "t1", title: "A", status: "in_progress", priority: "high" },
      { _id: "t2", title: "B", status: "review", priority: "high" },
      { _id: "t3", title: "C", status: "done", priority: "medium" },
      { _id: "t4", title: "D", status: "backlog", priority: "low" },
    ];
    render(<PipelineStageImplementation {...baseProps} tasks={tasks} />);
    // Status summary grid shows counts
    const headings = screen.getAllByText("1");
    expect(headings.length).toBeGreaterThanOrEqual(4);
  });
});
