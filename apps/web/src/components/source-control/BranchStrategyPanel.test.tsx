import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BranchStrategyPanel } from "./BranchStrategyPanel";

let mockQueryReturn: any;
const mockMutationFn = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
  useMutation: () => mockMutationFn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      branching: {
        strategyRecommendation: {
          getStrategyForSprint:
            "sourceControl.branching.strategyRecommendation:getStrategyForSprint",
          requestStrategy: "sourceControl.branching.strategyRecommendation:requestStrategy",
        },
      },
    },
  },
}));

const mockStrategy = {
  branchStrategy: {
    strategy_type: "feature_branches",
    rationale: "Feature branches recommended for this sprint.",
    recommended_branches: [
      {
        branch_name: "feat/checkout",
        purpose: "Checkout flow implementation",
        parent_branch: "main",
        workstreams: ["Frontend"],
        tasks: [],
        merge_timing: "End of sprint",
      },
    ],
    overlap_warnings: [
      {
        file_or_module: "src/utils/auth.ts",
        workstreams: ["Frontend", "Backend"],
        conflict_risk: "high",
        recommendation: "Coordinate changes carefully",
      },
    ],
    merge_order: [
      {
        branch: "feat/checkout",
        merge_into: "main",
        order: 1,
        rationale: "Merge after testing",
      },
    ],
  },
};

describe("BranchStrategyPanel", () => {
  it("shows loading state when data is undefined", () => {
    mockQueryReturn = undefined;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText("Loading strategy data...")).toBeInTheDocument();
  });

  it("shows empty state with Generate button when null", () => {
    mockQueryReturn = null;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText(/No branch strategy recommendations/)).toBeInTheDocument();
    expect(screen.getByText("Generate Strategy")).toBeInTheDocument();
  });

  it("calls mutation on Generate Strategy click", async () => {
    mockQueryReturn = null;
    const user = userEvent.setup();
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    await user.click(screen.getByText("Generate Strategy"));
    expect(mockMutationFn).toHaveBeenCalled();
  });

  it("renders strategy type badge", () => {
    mockQueryReturn = mockStrategy;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText("Feature Branches")).toBeInTheDocument();
  });

  it("renders rationale text", () => {
    mockQueryReturn = mockStrategy;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText("Feature branches recommended for this sprint.")).toBeInTheDocument();
  });

  it("renders recommended branches", () => {
    mockQueryReturn = mockStrategy;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText("Recommended Branches")).toBeInTheDocument();
    const branchNames = screen.getAllByText("feat/checkout");
    expect(branchNames.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Checkout flow implementation")).toBeInTheDocument();
  });

  it("renders overlap warnings with risk badge", () => {
    mockQueryReturn = mockStrategy;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText("Overlap Warnings")).toBeInTheDocument();
    expect(screen.getByText("src/utils/auth.ts")).toBeInTheDocument();
    expect(screen.getByText("high risk")).toBeInTheDocument();
  });

  it("renders merge order", () => {
    mockQueryReturn = mockStrategy;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText("Recommended Merge Order")).toBeInTheDocument();
    expect(screen.getByText("Merge after testing")).toBeInTheDocument();
  });

  it("shows Refresh button when strategy exists", () => {
    mockQueryReturn = mockStrategy;
    render(<BranchStrategyPanel sprintId={"sprint-1" as any} programId={"prog-1" as any} />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });
});
