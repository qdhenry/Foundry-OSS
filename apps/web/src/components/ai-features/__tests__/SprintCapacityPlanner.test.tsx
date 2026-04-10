import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── GSAP mocks (barrel export triggers gsap loading) ──────────────
vi.mock("gsap", () => {
  const gsapMock = {
    set: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    matchMedia: vi.fn(() => ({ add: vi.fn() })),
    registerPlugin: vi.fn(),
  };
  return { default: gsapMock };
});
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("gsap/Flip", () => ({ Flip: { getState: vi.fn(), from: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));

import { SprintCapacityPlanner } from "@foundry/ui/sprints";

// Track query results by query name
let mockQueryData: Record<string, unknown> = {};
const mockBulkAssign = vi.fn();
const mockPlanSprint = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (queryName: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    return mockQueryData[String(queryName)];
  },
  useMutation: (name: unknown) => {
    const n = String(name);
    if (n.includes("bulkAssign")) return mockBulkAssign;
    if (n.includes("requestSprintPlan")) return mockPlanSprint;
    return vi.fn();
  },
}));

vi.mock("lucide-react", () => {
  const Icon = (props: Record<string, unknown>) => <span data-testid="icon" {...props} />;
  return {
    CheckSquare: Icon,
    Square: Icon,
    AlertTriangle: Icon,
    Loader2: Icon,
    Sparkles: Icon,
    Plus: Icon,
  };
});

const defaultProps = {
  sprintId: "sprint-1",
  programId: "prog-1",
};

const mockTasks = [
  {
    _id: "task-1",
    title: "Implement user auth",
    priority: "critical",
    status: "backlog",
    requirementRefId: "REQ-001",
  },
  {
    _id: "task-2",
    title: "Product catalog sync",
    priority: "high",
    status: "backlog",
    requirementRefId: "REQ-002",
  },
];

describe("SprintCapacityPlanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryData = {};
    mockBulkAssign.mockResolvedValue(undefined);
    mockPlanSprint.mockResolvedValue(undefined);
  });

  it("renders loading state when tasks are undefined", () => {
    render(<SprintCapacityPlanner {...defaultProps} />);
    expect(screen.getByText("Loading tasks...")).toBeInTheDocument();
  });

  it("renders empty state when no unassigned tasks", () => {
    mockQueryData["tasks:listUnassignedByProgram"] = [];
    mockQueryData["tasks:countBySprint"] = 0;
    render(<SprintCapacityPlanner {...defaultProps} />);
    expect(screen.getByText("No unassigned tasks")).toBeInTheDocument();
  });

  it("renders task table with task data", () => {
    mockQueryData["tasks:listUnassignedByProgram"] = mockTasks;
    mockQueryData["tasks:countBySprint"] = 0;
    render(<SprintCapacityPlanner {...defaultProps} />);
    expect(screen.getByText("Implement user auth")).toBeInTheDocument();
    expect(screen.getByText("Product catalog sync")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("renders column headers in task table", () => {
    mockQueryData["tasks:listUnassignedByProgram"] = mockTasks;
    mockQueryData["tasks:countBySprint"] = 0;
    render(<SprintCapacityPlanner {...defaultProps} />);
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Requirement")).toBeInTheDocument();
  });

  it("disables Add Selected button when no tasks selected", () => {
    mockQueryData["tasks:listUnassignedByProgram"] = mockTasks;
    mockQueryData["tasks:countBySprint"] = 0;
    render(<SprintCapacityPlanner {...defaultProps} />);
    const addButton = screen.getByText(/Add Selected to Sprint/).closest("button");
    expect(addButton).toBeDisabled();
  });

  it("renders Ask AI for Suggestions button", () => {
    mockQueryData["tasks:listUnassignedByProgram"] = mockTasks;
    mockQueryData["tasks:countBySprint"] = 0;
    render(<SprintCapacityPlanner {...defaultProps} />);
    expect(screen.getByText("Ask AI for Suggestions")).toBeInTheDocument();
  });

  it("shows assigned count when tasks are assigned to sprint", () => {
    mockQueryData["tasks:listUnassignedByProgram"] = mockTasks;
    mockQueryData["tasks:countBySprint"] = 3;
    render(<SprintCapacityPlanner {...defaultProps} />);
    expect(screen.getByText("Sprint Tasks")).toBeInTheDocument();
    expect(screen.getByText("3 assigned")).toBeInTheDocument();
  });

  it("shows requirement ref IDs in task table", () => {
    mockQueryData["tasks:listUnassignedByProgram"] = mockTasks;
    mockQueryData["tasks:countBySprint"] = 0;
    render(<SprintCapacityPlanner {...defaultProps} />);
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("REQ-002")).toBeInTheDocument();
  });

  it("selects task when row is clicked", async () => {
    const user = userEvent.setup();
    mockQueryData["tasks:listUnassignedByProgram"] = mockTasks;
    mockQueryData["tasks:countBySprint"] = 0;
    render(<SprintCapacityPlanner {...defaultProps} />);

    const row = screen.getByText("Implement user auth").closest("tr")!;
    await user.click(row);

    // After clicking, Add Selected button should show count
    expect(screen.getByText(/Add Selected to Sprint \(1\)/)).toBeInTheDocument();
  });
});
