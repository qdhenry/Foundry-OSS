import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReadinessMatrix } from "./ReadinessMatrix";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      completeness: {
        readinessMatrix: {
          getForProgram: "sourceControl.completeness.readinessMatrix:getForProgram",
        },
      },
    },
  },
}));

const mockMatrixData = {
  totalRequirements: 5,
  warningCount: 2,
  entries: [
    {
      requirementId: "req-1",
      refId: "REQ-001",
      title: "Login Feature",
      scopeCompleteness: 90,
      implementationCompleteness: 85,
      quadrant: "READY",
      color: "green",
      description: "Login",
      isWarning: false,
    },
    {
      requirementId: "req-2",
      refId: "REQ-002",
      title: "Payment Flow",
      scopeCompleteness: 20,
      implementationCompleteness: 60,
      quadrant: "DANGER",
      color: "red",
      description: "Payment",
      isWarning: true,
    },
  ],
  summary: {
    READY: 1,
    IN_PROGRESS: 0,
    SPECIFIED: 0,
    DEFINED: 0,
    RISKY: 0,
    REVIEW: 0,
    BACKLOG: 0,
    DANGER: 1,
    ROGUE: 0,
  },
};

describe("ReadinessMatrix", () => {
  it("shows loading text when data is undefined", () => {
    mockQueryReturn = undefined;
    render(<ReadinessMatrix programId={"prog-1" as any} />);
    expect(screen.getByText("Loading readiness matrix...")).toBeInTheDocument();
  });

  it("shows empty state when no entries", () => {
    mockQueryReturn = { entries: [], totalRequirements: 0, warningCount: 0, summary: {} };
    render(<ReadinessMatrix programId={"prog-1" as any} />);
    expect(
      screen.getByText(/Connect repositories to see implementation readiness/),
    ).toBeInTheDocument();
  });

  it("renders total requirements count", () => {
    mockQueryReturn = mockMatrixData;
    render(<ReadinessMatrix programId={"prog-1" as any} />);
    expect(screen.getByText("5 requirements")).toBeInTheDocument();
  });

  it("renders warning count badge", () => {
    mockQueryReturn = mockMatrixData;
    render(<ReadinessMatrix programId={"prog-1" as any} />);
    expect(screen.getByText("2 warnings")).toBeInTheDocument();
  });

  it("renders quadrant labels in grid", () => {
    mockQueryReturn = mockMatrixData;
    render(<ReadinessMatrix programId={"prog-1" as any} />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Danger")).toBeInTheDocument();
    expect(screen.getByText("Backlog")).toBeInTheDocument();
  });

  it("renders summary chips for non-zero quadrants", () => {
    mockQueryReturn = mockMatrixData;
    render(<ReadinessMatrix programId={"prog-1" as any} />);
    expect(screen.getByText(/Ready 1/)).toBeInTheDocument();
    expect(screen.getByText(/Danger 1/)).toBeInTheDocument();
  });

  it("renders axis labels", () => {
    mockQueryReturn = mockMatrixData;
    render(<ReadinessMatrix programId={"prog-1" as any} />);
    expect(screen.getByText("Scope Completeness")).toBeInTheDocument();
    expect(screen.getByText("Implementation Completeness")).toBeInTheDocument();
  });
});
