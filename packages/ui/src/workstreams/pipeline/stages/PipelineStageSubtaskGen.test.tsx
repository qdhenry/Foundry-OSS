import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageSubtaskGen } from "./PipelineStageSubtaskGen";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseProps = {
  requirement: { _id: "req-1", refId: "REQ-001", title: "Test Req" },
  programId: "prog-1",
  workstreamId: "ws-1",
};

describe("PipelineStageSubtaskGen", () => {
  it("renders heading", () => {
    render(<PipelineStageSubtaskGen {...baseProps} tasks={[]} />);
    expect(screen.getByText("Subtask Generation")).toBeInTheDocument();
  });

  it("shows empty message when no tasks", () => {
    render(<PipelineStageSubtaskGen {...baseProps} tasks={[]} />);
    expect(screen.getByText(/No tasks exist yet/)).toBeInTheDocument();
  });

  it("shows tasks with subtasks and progress bar", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Task A",
        status: "in_progress",
        hasSubtasks: true,
        subtaskCount: 5,
        subtasksCompleted: 3,
      },
    ];
    render(<PipelineStageSubtaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Tasks with Subtasks (1)")).toBeInTheDocument();
    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.getByText("3/5 complete")).toBeInTheDocument();
  });

  it("shows tasks awaiting subtask generation", () => {
    const tasks = [{ _id: "t1", title: "Pending Task", status: "backlog" }];
    render(<PipelineStageSubtaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Awaiting Subtask Generation (1)")).toBeInTheDocument();
    expect(screen.getByText("Pending Task")).toBeInTheDocument();
  });

  it("shows next steps for tasks awaiting generation", () => {
    const tasks = [
      { _id: "t1", title: "Task", status: "backlog" },
      { _id: "t2", title: "Task 2", status: "todo" },
    ];
    render(<PipelineStageSubtaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText(/2 tasks awaiting subtask generation/)).toBeInTheDocument();
  });
});
