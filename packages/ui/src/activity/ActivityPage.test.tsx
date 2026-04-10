import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityPage } from "./ActivityPage";

let mockExecutions: any;

vi.mock("convex/react", () => ({
  useQuery: (name: string) => {
    if (typeof name === "string" && name.includes("agentExecutions")) return mockExecutions;
    return undefined;
  },
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ programId: "prog_1" }),
}));

vi.mock("./ActivityDashboard", () => ({
  ActivityDashboard: () => <div data-testid="activity-dashboard" />,
}));

vi.mock("./ActivityTrace", () => ({
  ActivityTrace: () => <div data-testid="activity-trace" />,
}));

vi.mock("./CoverageDetail", () => ({
  CoverageDetail: () => <div data-testid="coverage-detail" />,
}));

describe("ActivityPage", () => {
  it("renders loading state when executions undefined", () => {
    mockExecutions = undefined;
    render(<ActivityPage />);
    expect(screen.getByText("Loading activity...")).toBeInTheDocument();
  });

  it("renders empty state when no executions", () => {
    mockExecutions = [];
    render(<ActivityPage />);
    expect(screen.getByText("No agent activity yet")).toBeInTheDocument();
  });

  it("renders dashboard view when executions exist", () => {
    mockExecutions = [{ _id: "exec_1", requirementTitle: "Test" }];
    render(<ActivityPage />);
    expect(screen.getByTestId("activity-dashboard")).toBeInTheDocument();
  });

  it("renders Agent Activity heading in dashboard view", () => {
    mockExecutions = [{ _id: "exec_1" }];
    render(<ActivityPage />);
    expect(screen.getByText("Agent Activity")).toBeInTheDocument();
  });
});
