import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageTaskGen } from "./PipelineStageTaskGen";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useQuery: () => null,
  useMutation: () => vi.fn(),
}));

vi.mock("../TaskDecompositionPanel", () => ({
  TaskDecompositionPanel: () => <div data-testid="decomposition-panel">Decomposition</div>,
}));

const baseProps = {
  requirement: { _id: "req-1", refId: "REQ-001", title: "Test" },
  programId: "prog-1",
  workstreamId: "ws-1",
};

describe("PipelineStageTaskGen", () => {
  it("renders decomposition panel", () => {
    render(<PipelineStageTaskGen {...baseProps} tasks={[]} />);
    expect(screen.getByTestId("decomposition-panel")).toBeInTheDocument();
  });

  it("shows active tasks list when tasks exist", () => {
    const tasks = [
      { _id: "t1", title: "Build UI", status: "todo", priority: "high" },
      { _id: "t2", title: "Write API", status: "backlog", priority: "medium" },
    ];
    render(<PipelineStageTaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Active Tasks (2)")).toBeInTheDocument();
    expect(screen.getByText("Build UI")).toBeInTheDocument();
    expect(screen.getByText("Write API")).toBeInTheDocument();
  });

  it("does not show active tasks section when no tasks", () => {
    render(<PipelineStageTaskGen {...baseProps} tasks={[]} />);
    expect(screen.queryByText(/Active Tasks/)).not.toBeInTheDocument();
  });

  it("shows task status labels", () => {
    const tasks = [{ _id: "t1", title: "Task", status: "done", priority: "high" }];
    render(<PipelineStageTaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});
