import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());
vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
}));

// Mock ConnectRepositoryInline
vi.mock("@foundry/ui/source-control", () => ({
  ConnectRepositoryInline: () => <div data-testid="connect-repo-inline">Connect Repo</div>,
}));

import { BranchStrategyPanel } from "./BranchStrategyPanel";

describe("BranchStrategyPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(undefined);
  });

  it("shows disabled state with message when sprintPlanComplete is false", () => {
    render(
      <BranchStrategyPanel sprintId="sprint-1" programId="prog-1" sprintPlanComplete={false} />,
    );
    expect(screen.getByText("Complete sprint planning first")).toBeInTheDocument();
    expect(
      screen.getByText("Add at least one task to this sprint to generate a branch strategy."),
    ).toBeInTheDocument();
  });

  it("renders Branch Strategy heading in disabled state", () => {
    render(
      <BranchStrategyPanel sprintId="sprint-1" programId="prog-1" sprintPlanComplete={false} />,
    );
    expect(screen.getByText("Branch Strategy")).toBeInTheDocument();
  });

  it("shows 'Generate Strategy' button when enabled and no strategy exists", () => {
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "sourceControl/branching/strategyRecommendation:getStrategyForSprint")
        return null;
      if (queryName === "sourceControl/repositories:listByProgram") return [{ _id: "repo-1" }];
      return undefined;
    });
    render(
      <BranchStrategyPanel sprintId="sprint-1" programId="prog-1" sprintPlanComplete={true} />,
    );
    expect(screen.getByText("Generate Strategy")).toBeInTheDocument();
  });

  it("shows loading state while strategy data is loading", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(
      <BranchStrategyPanel sprintId="sprint-1" programId="prog-1" sprintPlanComplete={true} />,
    );
    expect(screen.getByText("Loading strategy data...")).toBeInTheDocument();
  });

  it("shows connect repository inline when no repos and strategy is null", () => {
    mockUseQuery.mockImplementation((queryName: string) => {
      if (queryName === "sourceControl/branching/strategyRecommendation:getStrategyForSprint")
        return null;
      if (queryName === "sourceControl/repositories:listByProgram") return [];
      return undefined;
    });
    render(
      <BranchStrategyPanel sprintId="sprint-1" programId="prog-1" sprintPlanComplete={true} />,
    );
    expect(screen.getByTestId("connect-repo-inline")).toBeInTheDocument();
  });

  describe("strategyData prop", () => {
    it("uses strategyData prop and skips local query when provided", () => {
      const strategyData = {
        status: "pending",
        branchStrategy: {
          strategy_type: "feature_branches",
          rationale: "Feature branches for isolation",
          recommended_branches: [
            {
              branch_name: "feature/auth",
              purpose: "Auth flow",
              parent_branch: "main",
              workstreams: [],
              tasks: [],
              merge_timing: "After tests",
            },
          ],
          overlap_warnings: [],
          merge_order: [],
        },
      };
      render(
        <BranchStrategyPanel
          sprintId="sprint-1"
          programId="prog-1"
          sprintPlanComplete={true}
          strategyData={strategyData}
        />,
      );
      expect(screen.getByText("Branch Strategy")).toBeInTheDocument();
      expect(screen.getByText("Feature Branches")).toBeInTheDocument();
      // Strategy query should be skipped when prop is provided
      const strategyCalls = mockUseQuery.mock.calls.filter(
        (c: any[]) =>
          c[0] === "sourceControl/branching/strategyRecommendation:getStrategyForSprint",
      );
      expect(strategyCalls.every((c: any[]) => c[1] === "skip")).toBe(true);
    });
  });

  describe("collapsible behavior", () => {
    const completedStrategy = {
      status: "pending",
      branchStrategy: {
        strategy_type: "feature_branches" as const,
        rationale: "Feature branches for parallel work",
        recommended_branches: [
          {
            branch_name: "feature/auth",
            purpose: "Auth flow",
            parent_branch: "main",
            workstreams: ["WS-1"],
            tasks: [],
            merge_timing: "After tests",
          },
          {
            branch_name: "feature/ui",
            purpose: "UI work",
            parent_branch: "main",
            workstreams: ["WS-1"],
            tasks: [],
            merge_timing: "After review",
          },
        ],
        overlap_warnings: [
          {
            file_or_module: "shared/utils",
            workstreams: ["WS-1"],
            conflict_risk: "medium",
            recommendation: "Coordinate",
          },
        ],
        merge_order: [],
      },
    };

    it("renders collapsed by default with summary", () => {
      render(
        <BranchStrategyPanel
          sprintId="sprint-1"
          programId="prog-1"
          sprintPlanComplete={true}
          strategyData={completedStrategy}
        />,
      );
      expect(screen.getByText("Branch Strategy")).toBeInTheDocument();
      expect(screen.getByText(/2 branches/)).toBeInTheDocument();
      expect(screen.getByText(/1 warning/)).toBeInTheDocument();
      // Detail content should not be visible
      expect(screen.queryByText("Feature branches for parallel work")).not.toBeInTheDocument();
      expect(screen.queryByText("Recommended Branches (2)")).not.toBeInTheDocument();
    });

    it("expands to show details on click", async () => {
      const user = (await import("@testing-library/user-event")).default.setup();
      render(
        <BranchStrategyPanel
          sprintId="sprint-1"
          programId="prog-1"
          sprintPlanComplete={true}
          strategyData={completedStrategy}
        />,
      );

      // Click the header to expand
      await user.click(screen.getByText("Branch Strategy"));

      // Detail content should now be visible
      expect(screen.getByText("Feature branches for parallel work")).toBeInTheDocument();
      expect(screen.getByText("Recommended Branches (2)")).toBeInTheDocument();
    });
  });
});
