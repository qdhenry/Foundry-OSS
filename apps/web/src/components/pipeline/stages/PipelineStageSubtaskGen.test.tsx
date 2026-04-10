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
  requirement: { _id: "req-1", refId: "BM-001", title: "Test Req" },
  programId: "prog-1" as any,
  workstreamId: "ws-1" as any,
};

describe("PipelineStageSubtaskGen", () => {
  it("renders Subtask Generation heading", () => {
    render(<PipelineStageSubtaskGen {...baseProps} tasks={[]} />);
    expect(screen.getByText("Subtask Generation")).toBeInTheDocument();
  });

  it("shows message when no tasks exist", () => {
    render(<PipelineStageSubtaskGen {...baseProps} tasks={[]} />);
    expect(screen.getByText(/No tasks exist yet/)).toBeInTheDocument();
  });

  it("shows tasks awaiting subtask generation", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Build page",
        status: "backlog",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
      {
        _id: "t2",
        title: "API endpoint",
        status: "todo",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
    ];
    render(<PipelineStageSubtaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText(/Awaiting Subtask Generation \(2\)/)).toBeInTheDocument();
    expect(screen.getByText("Build page")).toBeInTheDocument();
    expect(screen.getByText("API endpoint")).toBeInTheDocument();
  });

  it("shows tasks with subtasks and progress", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Build page",
        status: "in_progress",
        hasSubtasks: true,
        subtaskCount: 5,
        subtasksCompleted: 3,
      },
    ];
    render(<PipelineStageSubtaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText(/Tasks with Subtasks \(1\)/)).toBeInTheDocument();
    expect(screen.getByText("3/5 complete")).toBeInTheDocument();
  });

  it("shows next step when tasks need subtask generation", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Task A",
        status: "backlog",
        hasSubtasks: false,
        subtaskCount: 0,
        subtasksCompleted: 0,
      },
    ];
    render(<PipelineStageSubtaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText(/1 task awaiting subtask generation/)).toBeInTheDocument();
  });

  it("shows review step when subtasks are incomplete", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Task A",
        status: "in_progress",
        hasSubtasks: true,
        subtaskCount: 3,
        subtasksCompleted: 1,
      },
    ];
    render(<PipelineStageSubtaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Review generated subtasks")).toBeInTheDocument();
  });
});
