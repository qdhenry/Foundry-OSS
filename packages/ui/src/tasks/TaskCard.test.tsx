import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskCard } from "./TaskCard";

const mockPush = vi.fn();
const mockUpdateStatus = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateStatus,
}));

vi.mock("../source-control/RepoBadge", () => ({
  RepoBadge: ({ repoFullName }: { repoFullName: string }) => (
    <span data-testid="repo-badge">{repoFullName}</span>
  ),
}));

vi.mock("../theme/useAnimations", () => ({
  useProgressBar: () => {},
}));

function makeTask(overrides = {}) {
  return {
    _id: "task-1",
    title: "Implement login page",
    description: "Build the auth UI",
    priority: "high" as const,
    status: "todo" as const,
    ...overrides,
  };
}

describe("TaskCard", () => {
  it("renders task title", () => {
    render(<TaskCard task={makeTask()} programId="prog-1" programSlug="my-program" />);
    expect(screen.getByText("Implement login page")).toBeInTheDocument();
  });

  it("renders task description", () => {
    render(<TaskCard task={makeTask()} programId="prog-1" programSlug="my-program" />);
    expect(screen.getByText("Build the auth UI")).toBeInTheDocument();
  });

  it("hides description in compact mode", () => {
    render(<TaskCard task={makeTask()} programId="prog-1" programSlug="my-program" compact />);
    expect(screen.queryByText("Build the auth UI")).not.toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<TaskCard task={makeTask()} programId="prog-1" programSlug="my-program" />);
    expect(screen.getByText("To Do")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<TaskCard task={makeTask()} programId="prog-1" programSlug="my-program" />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders assignee name", () => {
    render(
      <TaskCard
        task={makeTask({ assigneeName: "Alice" })}
        programId="prog-1"
        programSlug="my-program"
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders sprint name", () => {
    render(
      <TaskCard
        task={makeTask({ sprintName: "Sprint 3" })}
        programId="prog-1"
        programSlug="my-program"
      />,
    );
    expect(screen.getByText("Sprint 3")).toBeInTheDocument();
  });

  it("renders workstream short code", () => {
    render(
      <TaskCard
        task={makeTask({ workstreamShortCode: "WS-01" })}
        programId="prog-1"
        programSlug="my-program"
      />,
    );
    expect(screen.getByText("WS-01")).toBeInTheDocument();
  });

  it("renders design badge when hasDesignSnapshot", () => {
    render(
      <TaskCard
        task={makeTask({ hasDesignSnapshot: true })}
        programId="prog-1"
        programSlug="my-program"
      />,
    );
    expect(screen.getByText("Design")).toBeInTheDocument();
  });

  it("renders subtask progress bar", () => {
    render(
      <TaskCard
        task={makeTask({ hasSubtasks: true, subtaskCount: 5, subtasksCompleted: 3 })}
        programId="prog-1"
        programSlug="my-program"
      />,
    );
    expect(screen.getByText("3/5")).toBeInTheDocument();
  });

  it("renders failed subtask count", () => {
    render(
      <TaskCard
        task={makeTask({
          hasSubtasks: true,
          subtaskCount: 5,
          subtasksCompleted: 2,
          subtasksFailed: 1,
        })}
        programId="prog-1"
        programSlug="my-program"
      />,
    );
    expect(screen.getByText("1 failed")).toBeInTheDocument();
  });

  it("opens status menu on status badge click", () => {
    render(<TaskCard task={makeTask()} programId="prog-1" programSlug="my-program" />);
    fireEvent.click(screen.getByText("To Do"));
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders repo badge when repoFullName provided", () => {
    render(
      <TaskCard
        task={makeTask({ repoFullName: "org/repo" })}
        programId="prog-1"
        programSlug="my-program"
      />,
    );
    expect(screen.getByTestId("repo-badge")).toBeInTheDocument();
  });

  it("renders due date", () => {
    const dueDate = new Date("2026-06-15T12:00:00").getTime();
    const formatted = new Date(dueDate).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    render(<TaskCard task={makeTask({ dueDate })} programId="prog-1" programSlug="my-program" />);
    expect(screen.getByText(formatted)).toBeInTheDocument();
  });
});
