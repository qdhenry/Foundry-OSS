import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockEvaluateGate = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => mockEvaluateGate,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: ({ className }: any) => <span data-testid="icon-alert" className={className} />,
  ArrowRight: ({ className }: any) => <span data-testid="icon-arrow" className={className} />,
  CheckCircle: ({ className }: any) => <span data-testid="icon-check" className={className} />,
  Clock: ({ className }: any) => <span data-testid="icon-clock" className={className} />,
  ShieldCheck: ({ className }: any) => <span data-testid="icon-shield" className={className} />,
  XCircle: ({ className }: any) => <span data-testid="icon-x" className={className} />,
}));

import { SprintGateEvaluator } from "./SprintGateEvaluator";

describe("SprintGateEvaluator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    expect(screen.getByText("Loading gate evaluation...")).toBeInTheDocument();
  });

  it("shows empty state with evaluate button when no data", () => {
    mockUseQuery.mockReturnValue(null);
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    expect(screen.getByText("No gate evaluation available")).toBeInTheDocument();
    expect(screen.getByText("Evaluate Gate")).toBeInTheDocument();
  });

  it("calls evaluateGate on button click", () => {
    mockUseQuery.mockReturnValue(null);
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    fireEvent.click(screen.getByText("Evaluate Gate"));
    expect(mockEvaluateGate).toHaveBeenCalledWith({ sprintId: "s1" });
  });

  it("renders readiness score", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        overall_readiness: 75,
        gate_criteria: [],
        critical_blockers: [],
        recommendations: [],
        next_steps: [],
      },
    });
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Overall Readiness")).toBeInTheDocument();
  });

  it("renders gate criteria", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        overall_readiness: 80,
        gate_criteria: [
          { name: "Unit Tests", status: "pass", completion_percent: 100 },
          { name: "Code Review", status: "warning", completion_percent: 60 },
        ],
        critical_blockers: [],
        recommendations: [],
        next_steps: [],
      },
    });
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    expect(screen.getByText("Unit Tests")).toBeInTheDocument();
    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("Gate Criteria (2)")).toBeInTheDocument();
  });

  it("renders critical blockers", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        overall_readiness: 30,
        gate_criteria: [],
        critical_blockers: [
          {
            description: "Missing auth tests",
            impact_level: "critical",
            resolution_suggestion: "Add auth test suite",
            estimated_fix_time: "2h",
          },
        ],
        recommendations: [],
        next_steps: [],
      },
    });
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    expect(screen.getByText("Critical Blockers (1)")).toBeInTheDocument();
    expect(screen.getByText("Missing auth tests")).toBeInTheDocument();
    expect(screen.getByText("~2h")).toBeInTheDocument();
  });

  it("renders health assessment", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        overall_readiness: 90,
        gate_criteria: [],
        critical_blockers: [],
        health_assessment: {
          verdict: "ready",
          risk_summary: "Low risk across all areas",
          team_confidence: 0.85,
          schedule_impact: "On track",
        },
        recommendations: [],
        next_steps: [],
      },
    });
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    expect(screen.getByText("Health Assessment")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Low risk across all areas")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("renders recommendations and next steps", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        overall_readiness: 70,
        gate_criteria: [],
        critical_blockers: [],
        recommendations: ["Add integration tests"],
        next_steps: ["Deploy to staging"],
      },
    });
    render(<SprintGateEvaluator sprintId="s1" programId="p1" />);
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Add integration tests")).toBeInTheDocument();
    expect(screen.getByText("Next Steps")).toBeInTheDocument();
    expect(screen.getByText("Deploy to staging")).toBeInTheDocument();
  });
});
