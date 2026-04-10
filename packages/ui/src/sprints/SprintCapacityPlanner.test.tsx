import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  CheckSquare: (props: any) => <span data-testid="check-square" {...props} />,
  Square: (props: any) => <span data-testid="square" {...props} />,
  AlertTriangle: (props: any) => <span data-testid="alert" {...props} />,
  Loader2: (props: any) => <span data-testid="loader" {...props} />,
  Sparkles: (props: any) => <span data-testid="sparkles" {...props} />,
  Plus: (props: any) => <span data-testid="plus" {...props} />,
  Clock: (props: any) => <span data-testid="clock" {...props} />,
}));

// Mock convex/react
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

import { SprintCapacityPlanner } from "./SprintCapacityPlanner";

const mockTasks = [
  {
    _id: "task-1",
    title: "Implement product sync",
    priority: "high",
    status: "todo",
    requirementRefId: "REQ-001",
  },
  {
    _id: "task-2",
    title: "Setup auth flow",
    priority: "medium",
    status: "todo",
    requirementRefId: "REQ-002",
  },
];

function setupQueries({
  workstreamTasks = undefined as typeof mockTasks | undefined,
  allTasks = mockTasks as typeof mockTasks | undefined,
  assignedCount = 0 as number | undefined,
  aiData = undefined as any,
} = {}) {
  mockUseQuery.mockImplementation((queryName: string) => {
    if (queryName === "tasks:listUnassignedByWorkstream") return workstreamTasks;
    if (queryName === "tasks:listUnassignedByProgram") return allTasks;
    if (queryName === "tasks:countBySprint") return assignedCount;
    if (queryName === "sprintPlanning:getRecommendation") return aiData;
    return undefined;
  });
}

describe("SprintCapacityPlanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders task selection table with task data", () => {
    setupQueries();
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
    expect(screen.getByText("Implement product sync")).toBeInTheDocument();
    expect(screen.getByText("Setup auth flow")).toBeInTheDocument();
  });

  it("shows scope toggle when workstreamId is provided", () => {
    setupQueries({ workstreamTasks: mockTasks });
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" workstreamId="ws-1" />);
    expect(screen.getByText("Workstream")).toBeInTheDocument();
    expect(screen.getByText("All Tasks")).toBeInTheDocument();
  });

  it("does not show scope toggle when no workstreamId", () => {
    setupQueries();
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
    // The scope toggle has both "Workstream" and "All Tasks" buttons side-by-side.
    // "Workstream" text may appear as a table column header, so check for the toggle buttons specifically.
    const allButtons = screen.getAllByRole("button");
    const scopeToggle = allButtons.find(
      (btn) => btn.textContent === "Workstream" && btn.className.includes("rounded-md"),
    );
    expect(scopeToggle).toBeUndefined();
  });

  it("'Add Selected to Sprint' button is disabled when nothing selected", () => {
    setupQueries();
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
    const addButton = screen.getByText(/Add Selected to Sprint/);
    expect(addButton.closest("button")).toBeDisabled();
  });

  it("'Add Selected to Sprint' button shows count when tasks are selected", async () => {
    setupQueries();
    const user = userEvent.setup();
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);

    // Click on a task row to select it (tr has onClick)
    const taskRow = screen.getByText("Implement product sync").closest("tr")!;
    await user.click(taskRow);

    expect(screen.getByText(/Add Selected to Sprint \(1\)/)).toBeInTheDocument();
  });

  it("shows 'Ask AI for Suggestions' button", () => {
    setupQueries();
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
    expect(screen.getByText("Ask AI for Suggestions")).toBeInTheDocument();
  });

  it("shows empty state when no tasks available", () => {
    setupQueries({ allTasks: [] });
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
    expect(screen.getByText("No unassigned tasks")).toBeInTheDocument();
  });

  it("shows selected count in action bar", async () => {
    setupQueries();
    const user = userEvent.setup();
    render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);

    // Initially 0 tasks selected
    expect(screen.getByText("0")).toBeInTheDocument();

    // Select both tasks
    const rows = screen.getAllByRole("row").slice(1); // skip header
    await user.click(rows[0]);
    await user.click(rows[1]);

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  describe("AI operation feedback", () => {
    it("shows processing banner with progress text", () => {
      setupQueries({
        aiData: {
          status: "processing",
          generationProgress: "Analyzing capacity and generating plan...",
          recommendation: null,
        },
      });
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
      expect(screen.getByText("Analyzing capacity and generating plan...")).toBeInTheDocument();
    });

    it("shows default progress text when generationProgress is null", () => {
      setupQueries({
        aiData: { status: "processing", recommendation: null },
      });
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
      expect(screen.getByText("AI is analyzing tasks...")).toBeInTheDocument();
    });

    it("shows streamed task count during processing", () => {
      setupQueries({
        aiData: {
          status: "processing",
          generationProgress: "Generated 3 tasks...",
          recommendation: {
            recommended_existing_tasks: [
              { task_id: "task-1" },
              { task_id: "task-2" },
              { task_id: "task-extra" },
            ],
          },
        },
      });
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
      // Shows count of streamed tasks visible in the current task list
      expect(screen.getByText(/recommended so far/)).toBeInTheDocument();
    });

    it("shows error banner with retry when AI fails", () => {
      setupQueries({
        aiData: {
          status: "error",
          error: "Context too large for model",
          recommendation: null,
        },
      });
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
      expect(screen.getByText("Context too large for model")).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("shows default error message when error field is empty", () => {
      setupQueries({
        aiData: { status: "error", recommendation: null },
      });
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
      expect(screen.getByText("AI analysis failed. Please try again.")).toBeInTheDocument();
    });

    it("shows recommendation banner with select button when complete", () => {
      setupQueries({
        aiData: {
          status: "pending",
          recommendation: {
            recommended_existing_tasks: [{ task_id: "task-1" }, { task_id: "task-2" }],
          },
        },
      });
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
      expect(screen.getByText("AI recommends 2 tasks")).toBeInTheDocument();
      expect(screen.getByText("Select recommended")).toBeInTheDocument();
    });

    it("shows 'all selected' state after selecting recommended tasks", async () => {
      setupQueries({
        aiData: {
          status: "pending",
          recommendation: {
            recommended_existing_tasks: [{ task_id: "task-1" }, { task_id: "task-2" }],
          },
        },
      });
      const user = userEvent.setup();
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);

      await user.click(screen.getByText("Select recommended"));
      expect(screen.getByText("All 2 recommended tasks selected")).toBeInTheDocument();
      expect(screen.getByText("Deselect recommended")).toBeInTheDocument();
    });

    it("shows partial selection count", async () => {
      setupQueries({
        aiData: {
          status: "pending",
          recommendation: {
            recommended_existing_tasks: [{ task_id: "task-1" }, { task_id: "task-2" }],
          },
        },
      });
      const user = userEvent.setup();
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);

      // Select just one recommended task by clicking its row
      const taskRow = screen.getByText("Implement product sync").closest("tr")!;
      await user.click(taskRow);

      expect(screen.getByText(/AI recommends 2 tasks \(1 selected\)/)).toBeInTheDocument();
    });

    it("shows applied banner when all recommended tasks have been assigned", () => {
      // All AI-recommended tasks are NOT in the unassigned list (they were assigned)
      setupQueries({
        allTasks: mockTasks, // task-1 and task-2
        aiData: {
          status: "pending",
          recommendation: {
            recommended_existing_tasks: [
              { task_id: "task-gone-1" }, // not in mockTasks
              { task_id: "task-gone-2" }, // not in mockTasks
            ],
          },
        },
      });
      render(<SprintCapacityPlanner sprintId="sprint-1" programId="prog-1" />);
      expect(screen.getByText("All 2 recommended tasks added to sprint")).toBeInTheDocument();
    });
  });
});
