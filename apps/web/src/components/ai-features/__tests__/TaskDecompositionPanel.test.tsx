import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskDecompositionPanel } from "../TaskDecompositionPanel";

// Mock convex/react
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useAction: () => vi.fn(),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
}));

// Mock convex generated api
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    taskDecomposition: {
      getLatestDecomposition: "taskDecomposition:getLatestDecomposition",
      requestDecomposition: "taskDecomposition:requestDecomposition",
    },
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ListTodo: (props: Record<string, unknown>) => <span data-testid="icon-list-todo" {...props} />,
  Zap: (props: Record<string, unknown>) => <span data-testid="icon-zap" {...props} />,
  CheckSquare: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-check-square" {...props} />
  ),
  ArrowRight: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-arrow-right" {...props} />
  ),
}));

const defaultProps = {
  requirementId: "req123" as any,
  programId: "prog123" as any,
};

const mockDecompositionData = {
  decomposition: {
    rationale: "This requirement should be split into frontend and backend tasks.",
    critical_considerations: [
      "API compatibility must be maintained",
      "Database migration requires downtime window",
    ],
    tasks: [
      {
        task_number: 1,
        title: "Create API endpoints",
        description: "Build REST endpoints for the new feature",
        story_points: 5,
        task_type: "development",
        depends_on: [],
        suggested_owner_role: "Backend Developer",
        acceptance_criteria: [
          "All endpoints return correct status codes",
          "Input validation is implemented",
        ],
      },
      {
        task_number: 2,
        title: "Build UI components",
        description: "Create React components for the feature",
        story_points: 3,
        task_type: "design",
        depends_on: [1],
        suggested_owner_role: "Frontend Developer",
        acceptance_criteria: ["Components match design specs"],
      },
      {
        task_number: 3,
        title: "Write integration tests",
        description: "End-to-end testing of the feature",
        story_points: 2,
        task_type: "testing",
        depends_on: [1, 2],
      },
    ],
    total_points: 10,
    estimated_sprints: 2,
  },
};

describe("TaskDecompositionPanel", () => {
  const mockGenerateTasks = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(mockGenerateTasks);
  });

  it("renders loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText("Loading task decomposition...")).toBeInTheDocument();
  });

  it("renders empty state with generate button when data is null", () => {
    mockUseQuery.mockReturnValue(null);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText("No task breakdown available")).toBeInTheDocument();
    expect(screen.getByText("Generate Tasks")).toBeInTheDocument();
  });

  it("renders decomposition rationale", () => {
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText("Decomposition Rationale")).toBeInTheDocument();
    expect(
      screen.getByText("This requirement should be split into frontend and backend tasks."),
    ).toBeInTheDocument();
  });

  it("renders critical considerations", () => {
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText("Critical Considerations")).toBeInTheDocument();
    expect(screen.getByText("API compatibility must be maintained")).toBeInTheDocument();
    expect(screen.getByText("Database migration requires downtime window")).toBeInTheDocument();
  });

  it("renders task list with story points and types", () => {
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText("Tasks (3)")).toBeInTheDocument();
    expect(screen.getByText("Create API endpoints")).toBeInTheDocument();
    expect(screen.getByText("Build UI components")).toBeInTheDocument();
    expect(screen.getByText("Write integration tests")).toBeInTheDocument();

    // Story points
    expect(screen.getByText("5 SP")).toBeInTheDocument();
    expect(screen.getByText("3 SP")).toBeInTheDocument();
    expect(screen.getByText("2 SP")).toBeInTheDocument();

    // Task types
    expect(screen.getByText("development")).toBeInTheDocument();
    expect(screen.getByText("design")).toBeInTheDocument();
    expect(screen.getByText("testing")).toBeInTheDocument();
  });

  it("renders task dependencies", () => {
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);
    const depElements = screen.getAllByText(/Depends on:/);
    expect(depElements).toHaveLength(2);
    expect(depElements[0].textContent).toContain("#1");
    expect(depElements[1].textContent).toContain("#1, #2");
  });

  it("renders suggested owner roles", () => {
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText(/Backend Developer/)).toBeInTheDocument();
    expect(screen.getByText(/Frontend Developer/)).toBeInTheDocument();
  });

  it("renders acceptance criteria", () => {
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText("All endpoints return correct status codes")).toBeInTheDocument();
    expect(screen.getByText("Input validation is implemented")).toBeInTheDocument();
  });

  it("renders total points and sprint count in footer", () => {
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText(/total points/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/estimated sprints/)).toBeInTheDocument();
  });

  it("generate tasks button calls action", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(null);
    render(<TaskDecompositionPanel {...defaultProps} />);

    await user.click(screen.getByText("Generate Tasks"));
    expect(mockGenerateTasks).toHaveBeenCalledWith({
      requirementId: "req123",
    });
  });

  it("accept all button selects all tasks", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);

    await user.click(screen.getByText("Accept All Tasks"));
    expect(screen.getByText("All Accepted")).toBeInTheDocument();
    expect(screen.queryByText("Accept All Tasks")).not.toBeInTheDocument();
  });

  it("toggles individual task selection", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(mockDecompositionData);
    render(<TaskDecompositionPanel {...defaultProps} />);

    // Find checkbox-like buttons (the square toggle buttons)
    const taskCards = screen.getAllByText(
      /Create API endpoints|Build UI components|Write integration tests/,
    );
    expect(taskCards).toHaveLength(3);

    // The component uses button elements as checkboxes
    const checkboxButtons = document.querySelectorAll('button[class*="h-4 w-4"]');
    expect(checkboxButtons.length).toBe(3);

    // Click first task checkbox
    await user.click(checkboxButtons[0]);

    // The card should now have green styling (selected state)
    const firstCard = checkboxButtons[0].closest('[class*="rounded-lg border"]');
    expect(firstCard?.className).toContain("border-green");
  });

  it("shows generating state while action is running", async () => {
    const user = userEvent.setup();
    mockGenerateTasks.mockReturnValue(new Promise(() => {}));
    mockUseQuery.mockReturnValue(null);
    render(<TaskDecompositionPanel {...defaultProps} />);

    await user.click(screen.getByText("Generate Tasks"));
    expect(screen.getByText("Generating...")).toBeInTheDocument();
  });
});
