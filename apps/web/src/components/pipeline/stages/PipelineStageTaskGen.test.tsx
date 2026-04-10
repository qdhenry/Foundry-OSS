import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageTaskGen } from "./PipelineStageTaskGen";

vi.mock("convex/react", () => ({
  useQuery: () => null,
  useMutation: () => vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    taskDecomposition: {
      getLatestDecomposition: "taskDecomposition:getLatestDecomposition",
      requestDecomposition: "taskDecomposition:requestDecomposition",
    },
  },
}));

vi.mock("../../ai-features/TaskDecompositionPanel", () => ({
  TaskDecompositionPanel: ({ requirementId }: any) => (
    <div data-testid="task-decomposition-panel">Decomp: {requirementId}</div>
  ),
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

describe("PipelineStageTaskGen", () => {
  it("renders TaskDecompositionPanel", () => {
    render(<PipelineStageTaskGen {...baseProps} tasks={[]} />);
    expect(screen.getByTestId("task-decomposition-panel")).toBeInTheDocument();
  });

  it("shows active tasks list when tasks exist", () => {
    const tasks = [
      {
        _id: "t1",
        title: "Build page",
        status: "backlog",
        priority: "high",
        assigneeName: "Alice",
      },
      { _id: "t2", title: "API endpoint", status: "todo", priority: "medium" },
    ];
    render(<PipelineStageTaskGen {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Active Tasks (2)")).toBeInTheDocument();
    expect(screen.getByText("Build page")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("To Do")).toBeInTheDocument();
  });

  it("does not show active tasks section when no tasks", () => {
    render(<PipelineStageTaskGen {...baseProps} tasks={[]} />);
    expect(screen.queryByText(/Active Tasks/)).not.toBeInTheDocument();
  });

  it("shows next step to run decomposition when no tasks and no decomp", () => {
    render(<PipelineStageTaskGen {...baseProps} tasks={[]} />);
    expect(screen.getByText("Run AI task decomposition")).toBeInTheDocument();
  });
});
