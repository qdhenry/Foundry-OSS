import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageImplementation } from "./PipelineStageImplementation";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../programs", () => ({
  useProgramContext: () => ({ slug: "test-prog" }),
}));

const baseProps = {
  requirement: { _id: "req-1", refId: "REQ-001", title: "Test Req" },
  programId: "prog-1",
  workstreamId: "ws-1",
};

describe("PipelineStageImplementation", () => {
  it("renders progress heading", () => {
    render(<PipelineStageImplementation {...baseProps} tasks={[]} />);
    expect(screen.getByText("Implementation Progress")).toBeInTheDocument();
  });

  it("shows correct completion counts", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "done", priority: "high" },
      { _id: "t2", title: "Task 2", status: "in_progress", priority: "medium" },
      { _id: "t3", title: "Task 3", status: "backlog", priority: "low" },
    ];
    render(<PipelineStageImplementation {...baseProps} tasks={tasks} />);
    expect(screen.getByText("1 of 3 tasks complete")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("renders task list with task titles", () => {
    const tasks = [
      { _id: "t1", title: "Build API", status: "done", priority: "high" },
      { _id: "t2", title: "Setup CI", status: "in_progress", priority: "medium" },
    ];
    render(<PipelineStageImplementation {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Build API")).toBeInTheDocument();
    expect(screen.getAllByText("Setup CI").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("shows assignee name when provided", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "todo", priority: "high", assigneeName: "John Doe" },
    ];
    render(<PipelineStageImplementation {...baseProps} tasks={tasks} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("shows status counts in summary grid", () => {
    const tasks = [
      { _id: "t1", title: "T1", status: "in_progress", priority: "high" },
      { _id: "t2", title: "T2", status: "review", priority: "medium" },
      { _id: "t3", title: "T3", status: "done", priority: "low" },
      { _id: "t4", title: "T4", status: "backlog", priority: "low" },
    ];
    render(<PipelineStageImplementation {...baseProps} tasks={tasks} />);
    expect(screen.getAllByText("In Progress").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("In Review").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Remaining")).toBeInTheDocument();
  });
});
