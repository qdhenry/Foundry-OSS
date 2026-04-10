import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequirementRefinementPanel } from "../RequirementRefinementPanel";

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
    requirementRefinement: {
      getRefinementSuggestions: "requirementRefinement:getRefinementSuggestions",
      requestRefinement: "requirementRefinement:requestRefinement",
    },
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Sparkles: (props: Record<string, unknown>) => <span data-testid="icon-sparkles" {...props} />,
  CheckCircle: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-check" {...props} />
  ),
  X: ({ size, ...props }: Record<string, unknown>) => <span data-testid="icon-x" {...props} />,
  GitBranch: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-gitbranch" {...props} />
  ),
}));

const defaultProps = {
  requirementId: "req123" as any,
  programId: "prog123" as any,
};

const mockRefinementData = {
  suggestions: {
    overall_assessment: "The requirement needs improvement in clarity and testability.",
    suggestions: [
      {
        category: "clarity",
        severity: "major",
        suggestion: "Add specific acceptance criteria",
        example_resolution: "As a user, I want to...",
      },
      {
        category: "testability",
        severity: "minor",
        suggestion: "Define measurable outcomes",
      },
    ],
    potential_split: {
      recommended: true,
      rationale: "Requirement covers two distinct capabilities",
      proposed_parts: [
        { title: "Part A", description: "First capability" },
        { title: "Part B", description: "Second capability" },
      ],
    },
  },
};

describe("RequirementRefinementPanel", () => {
  const mockRequestRefinement = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(mockRequestRefinement);
  });

  it("renders loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<RequirementRefinementPanel {...defaultProps} />);
    expect(screen.getByText("Loading refinement suggestions...")).toBeInTheDocument();
  });

  it("renders empty state with request button when data is null", () => {
    mockUseQuery.mockReturnValue(null);
    render(<RequirementRefinementPanel {...defaultProps} />);
    expect(screen.getByText("No refinement suggestions yet")).toBeInTheDocument();
    expect(screen.getByText("Request Refinement")).toBeInTheDocument();
  });

  it("renders overall assessment", () => {
    mockUseQuery.mockReturnValue(mockRefinementData);
    render(<RequirementRefinementPanel {...defaultProps} />);
    expect(screen.getByText("Overall Assessment")).toBeInTheDocument();
    expect(
      screen.getByText("The requirement needs improvement in clarity and testability."),
    ).toBeInTheDocument();
  });

  it("renders suggestion cards with category and severity badges", () => {
    mockUseQuery.mockReturnValue(mockRefinementData);
    render(<RequirementRefinementPanel {...defaultProps} />);
    expect(screen.getByText("Suggestions (2)")).toBeInTheDocument();
    expect(screen.getByText("clarity")).toBeInTheDocument();
    expect(screen.getByText("major")).toBeInTheDocument();
    expect(screen.getByText("Add specific acceptance criteria")).toBeInTheDocument();
    expect(screen.getByText("testability")).toBeInTheDocument();
    expect(screen.getByText("minor")).toBeInTheDocument();
  });

  it("renders example resolution when provided", () => {
    mockUseQuery.mockReturnValue(mockRefinementData);
    render(<RequirementRefinementPanel {...defaultProps} />);
    expect(screen.getByText(/As a user, I want to/)).toBeInTheDocument();
  });

  it("renders split recommendation when present", () => {
    mockUseQuery.mockReturnValue(mockRefinementData);
    render(<RequirementRefinementPanel {...defaultProps} />);
    expect(screen.getByText("Split Recommended")).toBeInTheDocument();
    expect(screen.getByText("Requirement covers two distinct capabilities")).toBeInTheDocument();
    expect(screen.getByText("Part A")).toBeInTheDocument();
    expect(screen.getByText("First capability")).toBeInTheDocument();
    expect(screen.getByText("Part B")).toBeInTheDocument();
    expect(screen.getByText("Second capability")).toBeInTheDocument();
    expect(screen.getByText("Accept Split")).toBeInTheDocument();
  });

  it("does not render split section when not recommended", () => {
    mockUseQuery.mockReturnValue({
      suggestions: {
        overall_assessment: "Good requirement.",
        suggestions: [],
        potential_split: { recommended: false },
      },
    });
    render(<RequirementRefinementPanel {...defaultProps} />);
    expect(screen.queryByText("Split Recommended")).not.toBeInTheDocument();
  });

  it("request refinement button calls action", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(null);
    render(<RequirementRefinementPanel {...defaultProps} />);

    await user.click(screen.getByText("Request Refinement"));
    expect(mockRequestRefinement).toHaveBeenCalledWith({
      requirementId: "req123",
    });
  });

  it("apply button marks suggestion as applied", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(mockRefinementData);
    render(<RequirementRefinementPanel {...defaultProps} />);

    const applyButtons = screen.getAllByText("Apply");
    await user.click(applyButtons[0]);

    expect(screen.getByText("Applied")).toBeInTheDocument();
  });

  it("dismiss button hides the suggestion", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(mockRefinementData);
    render(<RequirementRefinementPanel {...defaultProps} />);

    const dismissButtons = screen.getAllByText("Dismiss");
    await user.click(dismissButtons[0]);

    // First suggestion should be gone, but second remains
    expect(screen.queryByText("Add specific acceptance criteria")).not.toBeInTheDocument();
    expect(screen.getByText("Define measurable outcomes")).toBeInTheDocument();
  });

  it("accept split button updates state", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(mockRefinementData);
    render(<RequirementRefinementPanel {...defaultProps} />);

    await user.click(screen.getByText("Accept Split"));
    expect(screen.getByText("Split Accepted")).toBeInTheDocument();
    expect(screen.queryByText("Accept Split")).not.toBeInTheDocument();
  });

  it("shows analyzing state while requesting", async () => {
    const user = userEvent.setup();
    // Make the action never resolve to keep the loading state
    mockRequestRefinement.mockReturnValue(new Promise(() => {}));
    mockUseQuery.mockReturnValue(null);
    render(<RequirementRefinementPanel {...defaultProps} />);

    await user.click(screen.getByText("Request Refinement"));
    expect(screen.getByText("Analyzing...")).toBeInTheDocument();
  });
});
