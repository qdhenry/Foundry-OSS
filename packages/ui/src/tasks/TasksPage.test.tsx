import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock child components
vi.mock("./TaskBoard", () => ({
  TaskBoard: () => <div data-testid="task-board">TaskBoard</div>,
}));

vi.mock("./TaskCard", () => ({
  TaskCard: ({ task }: any) => <div data-testid="task-card">{task.title}</div>,
}));

vi.mock("./TaskFilters", () => ({
  TaskFilters: () => <div data-testid="task-filters">TaskFilters</div>,
}));

import { TasksPage } from "./TasksPage";

const mockTasks = [
  {
    _id: "task-1",
    title: "Implement product sync",
    priority: "high" as const,
    status: "in_progress" as const,
    sprintId: "sprint-1",
    sprintName: "Sprint 1",
  },
];

const mockSprints = [{ _id: "sprint-1", name: "Sprint 1", workstreamId: "ws-1", status: "active" }];

function setupQueries({
  tasks = mockTasks,
  sprints = mockSprints,
  activeSprint = { _id: "sprint-1", name: "Sprint 1" } as any,
  workstreams = [] as any[],
} = {}) {
  mockUseQuery.mockImplementation((queryName: string) => {
    if (queryName === "tasks:listByProgram") return tasks;
    if (queryName === "sprints:listByProgram") return sprints;
    if (queryName === "sprints:getActive") return activeSprint;
    if (queryName === "workstreams:listByProgram") return workstreams;
    return undefined;
  });
}

describe("TasksPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders view preset pills: Active Sprint, All Tasks, Backlog", () => {
    setupQueries();
    render(<TasksPage programId="prog-1" programSlug="test-program" />);
    expect(screen.getByText("Active Sprint")).toBeInTheDocument();
    expect(screen.getByText("All Tasks")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });

  it("shows sprint selector in Active Sprint mode when sprints exist", () => {
    setupQueries();
    render(<TasksPage programId="prog-1" programSlug="test-program" />);
    // Sprint selector should show Sprint 1 option
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("shows contextual subtitle for active sprint", () => {
    setupQueries();
    render(<TasksPage programId="prog-1" programSlug="test-program" />);
    expect(screen.getByText("1 task in Sprint 1")).toBeInTheDocument();
  });

  it("shows contextual subtitle for backlog mode", async () => {
    const user = userEvent.setup();
    setupQueries({
      tasks: [
        {
          _id: "task-2",
          title: "Backlog task",
          priority: "low" as const,
          status: "backlog" as const,
          sprintId: undefined,
          sprintName: undefined,
        },
      ],
    });
    render(<TasksPage programId="prog-1" programSlug="test-program" />);

    await user.click(screen.getByText("Backlog"));
    expect(screen.getByText(/in backlog/)).toBeInTheDocument();
  });

  it("shows empty state when no tasks and no active sprint", () => {
    setupQueries({ tasks: [], activeSprint: null });
    render(<TasksPage programId="prog-1" programSlug="test-program" />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
  });

  it("renders the page heading", () => {
    setupQueries();
    render(<TasksPage programId="prog-1" programSlug="test-program" />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });
});
