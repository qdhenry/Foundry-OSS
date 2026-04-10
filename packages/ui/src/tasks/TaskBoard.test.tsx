import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

// Mock TaskCard
vi.mock("./TaskCard", () => ({
  TaskCard: ({ task }: any) => <div data-testid={`task-card-${task._id}`}>{task.title}</div>,
}));

// Mock animation hook
vi.mock("../theme/useAnimations", () => ({
  useStaggerEntrance: vi.fn(),
}));

import { TaskBoard } from "./TaskBoard";

const mockTasks = [
  {
    _id: "task-1",
    title: "Setup database schema",
    priority: "high" as const,
    status: "todo" as const,
  },
  {
    _id: "task-2",
    title: "Implement API endpoint",
    priority: "medium" as const,
    status: "in_progress" as const,
  },
  {
    _id: "task-3",
    title: "Write tests",
    priority: "low" as const,
    status: "done" as const,
  },
];

const mockSprints = [
  { _id: "sprint-1", name: "Sprint 1" },
  { _id: "sprint-2", name: "Sprint 2" },
];

describe("TaskBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 'Select' button in toolbar", () => {
    render(
      <TaskBoard
        tasks={mockTasks}
        programId="prog-1"
        programSlug="test-program"
        sprints={mockSprints}
      />,
    );
    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("toggles to 'Cancel Select' when clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskBoard
        tasks={mockTasks}
        programId="prog-1"
        programSlug="test-program"
        sprints={mockSprints}
      />,
    );

    await user.click(screen.getByText("Select"));
    expect(screen.getByText("Cancel Select")).toBeInTheDocument();
  });

  it("exits select mode when 'Cancel Select' is clicked", async () => {
    const user = userEvent.setup();
    render(
      <TaskBoard
        tasks={mockTasks}
        programId="prog-1"
        programSlug="test-program"
        sprints={mockSprints}
      />,
    );

    await user.click(screen.getByText("Select"));
    expect(screen.getByText("Cancel Select")).toBeInTheDocument();

    await user.click(screen.getByText("Cancel Select"));
    expect(screen.getByText("Select")).toBeInTheDocument();
  });

  it("renders board column headers", () => {
    render(<TaskBoard tasks={mockTasks} programId="prog-1" programSlug="test-program" />);
    expect(screen.getByText("Backlog")).toBeInTheDocument();
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders task cards in correct columns", () => {
    render(<TaskBoard tasks={mockTasks} programId="prog-1" programSlug="test-program" />);
    expect(screen.getByText("Setup database schema")).toBeInTheDocument();
    expect(screen.getByText("Implement API endpoint")).toBeInTheDocument();
    expect(screen.getByText("Write tests")).toBeInTheDocument();
  });

  it("shows column task counts", () => {
    render(<TaskBoard tasks={mockTasks} programId="prog-1" programSlug="test-program" />);
    // Each column shows count - To Do has 1, In Progress has 1, Done has 1, others have 0
    const counts = screen.getAllByText("1");
    expect(counts.length).toBeGreaterThanOrEqual(3);

    const zeroCounts = screen.getAllByText("0");
    expect(zeroCounts.length).toBeGreaterThanOrEqual(2);
  });

  it("does not show bulk action bar when no tasks selected", () => {
    render(
      <TaskBoard
        tasks={mockTasks}
        programId="prog-1"
        programSlug="test-program"
        sprints={mockSprints}
      />,
    );
    expect(screen.queryByText("selected")).not.toBeInTheDocument();
  });
});
