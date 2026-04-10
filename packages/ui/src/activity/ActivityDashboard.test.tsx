import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityDashboard } from "./ActivityDashboard";
import type { EnrichedExecution } from "./utils";

function makeExecution(overrides: Partial<EnrichedExecution> = {}): EnrichedExecution {
  return {
    _id: "exec-1",
    _creationTime: Date.now(),
    programId: "prog-1",
    taskType: "code_review",
    trigger: "manual",
    reviewStatus: "pending",
    tokensUsed: 1000,
    ...overrides,
  };
}

describe("ActivityDashboard", () => {
  const defaultProps = {
    executions: [makeExecution()],
    totalRequirements: 10,
    searchQuery: "",
    onSearchChange: vi.fn(),
    onDrillDown: vi.fn(),
    onCoverageDrillDown: vi.fn(),
  };

  it("renders metric cards", () => {
    render(<ActivityDashboard {...defaultProps} />);
    expect(screen.getByText("Acceptance Rate")).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.getByText("Token Spend")).toBeInTheDocument();
    expect(screen.getByText("Coverage")).toBeInTheDocument();
  });

  it("renders recent activity section", () => {
    render(<ActivityDashboard {...defaultProps} />);
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<ActivityDashboard {...defaultProps} />);
    expect(
      screen.getByPlaceholderText("Search requirements, tasks, workstreams..."),
    ).toBeInTheDocument();
  });

  it("hides recent activity when no executions", () => {
    render(<ActivityDashboard {...defaultProps} executions={[]} />);
    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
  });
});
