import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDecompositionPanel } from "./TaskDecompositionPanel";

let mockQueryResult: any;
const mockGenerateTasks = vi.fn();
const mockAcceptDecomposition = vi.fn();
const mockRejectDecomposition = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryResult,
  useMutation: (name: unknown) => {
    const key = String(name);
    if (key.includes("requestDecomposition")) return mockGenerateTasks;
    if (key.includes("acceptDecomposition")) return mockAcceptDecomposition;
    if (key.includes("rejectDecomposition")) return mockRejectDecomposition;
    return vi.fn();
  },
}));

describe("TaskDecompositionPanel", () => {
  beforeEach(() => {
    mockQueryResult = undefined;
    mockGenerateTasks.mockReset();
    mockAcceptDecomposition.mockReset();
    mockRejectDecomposition.mockReset();
  });

  it("shows loading spinner when data is undefined", () => {
    mockQueryResult = undefined;

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("Loading task decomposition...")).toBeInTheDocument();
  });

  it("shows empty state with Generate Tasks button when no decomposition", () => {
    mockQueryResult = null;

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("No task breakdown available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Tasks" })).toBeInTheDocument();
  });

  it("shows error state with retry button", () => {
    mockQueryResult = { status: "error", error: "Something broke" };

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("Task generation failed")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows streaming progress during processing with no tasks yet", () => {
    mockQueryResult = {
      status: "processing",
      decomposition: null,
      generationProgress: "Analyzing requirement...",
    };

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("Analyzing requirement...")).toBeInTheDocument();
    expect(screen.getByText("Tasks will appear below as they are generated.")).toBeInTheDocument();
  });

  it("shows streaming tasks during processing", () => {
    mockQueryResult = {
      status: "processing",
      decomposition: {
        tasks: [
          {
            task_number: 1,
            title: "First task",
            story_points: 3,
            task_type: "development",
          },
        ],
      },
      generationProgress: "Generated 1 task...",
    };

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("First task")).toBeInTheDocument();
    expect(screen.getByText("Generated 1 task...")).toBeInTheDocument();
  });

  it("shows multiple streamed tasks during processing", () => {
    mockQueryResult = {
      status: "processing",
      decomposition: {
        tasks: [
          {
            task_number: 1,
            title: "Setup database schema",
            story_points: 2,
            task_type: "development",
          },
          {
            task_number: 2,
            title: "Build API endpoints",
            story_points: 5,
            task_type: "development",
          },
          {
            task_number: 3,
            title: "Write integration tests",
            story_points: 3,
            task_type: "testing",
          },
        ],
      },
      generationProgress: "Generated 3 tasks...",
    };

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("Setup database schema")).toBeInTheDocument();
    expect(screen.getByText("Build API endpoints")).toBeInTheDocument();
    expect(screen.getByText("Write integration tests")).toBeInTheDocument();
    expect(screen.getByText("Tasks (3)")).toBeInTheDocument();
  });

  it("shows task list with Accept/Reject buttons when pending_review", () => {
    mockQueryResult = {
      _id: "decomp-1",
      status: "pending_review",
      decomposition: {
        tasks: [
          {
            task_number: 1,
            title: "Implement login flow",
            description: "Build the auth login flow",
            story_points: 5,
            task_type: "development",
          },
          {
            task_number: 2,
            title: "Add unit tests",
            description: "Cover login with tests",
            story_points: 3,
            task_type: "testing",
          },
        ],
        rationale: "Test rationale",
        total_points: 8,
      },
    };

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("Implement login flow")).toBeInTheDocument();
    expect(screen.getByText("Add unit tests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept All Tasks/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeInTheDocument();
  });

  it("shows accepted state with success message", () => {
    mockQueryResult = { status: "accepted" };

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    expect(screen.getByText("Tasks created and added to backlog")).toBeInTheDocument();
  });

  it("calls generateTasks mutation when Generate Tasks clicked", async () => {
    mockQueryResult = null;

    render(<TaskDecompositionPanel requirementId="req-1" programId="prog-1" />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Generate Tasks" }));

    expect(mockGenerateTasks).toHaveBeenCalledWith({ requirementId: "req-1" });
  });
});
