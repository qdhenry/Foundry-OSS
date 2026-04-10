import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SprintGateEvaluator } from "../SprintGateEvaluator";

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
    sprintGateEvaluation: {
      getLatestEvaluation: "sprintGateEvaluation:getLatestEvaluation",
      requestGateEvaluation: "sprintGateEvaluation:requestGateEvaluation",
    },
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ShieldCheck: (props: Record<string, unknown>) => (
    <span data-testid="icon-shield-check" {...props} />
  ),
  CheckCircle: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-check-circle" {...props} />
  ),
  XCircle: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-x-circle" {...props} />
  ),
  AlertTriangle: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-alert" {...props} />
  ),
  Clock: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-clock" {...props} />
  ),
  ArrowRight: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-arrow-right" {...props} />
  ),
}));

const defaultProps = {
  sprintId: "sprint123" as any,
  programId: "prog123" as any,
};

const mockEvaluationData = {
  evaluation: {
    overall_readiness: 72,
    gate_criteria: [
      {
        name: "Code Coverage",
        status: "pass",
        completion_percent: 95,
        blockers: [],
      },
      {
        name: "Security Review",
        status: "warning",
        completion_percent: 60,
        blockers: ["Pending third-party audit"],
      },
      {
        name: "Performance Testing",
        status: "fail",
        completion_percent: 30,
        blockers: ["Load tests not completed", "Missing staging environment"],
      },
    ],
    critical_blockers: [
      {
        description: "Staging environment not provisioned",
        impact_level: "critical",
        resolution_suggestion: "Request cloud resources from DevOps",
        estimated_fix_time: "2 days",
      },
    ],
    health_assessment: {
      verdict: "conditional",
      risk_summary: "Sprint can proceed with conditions on security review completion",
      team_confidence: 0.65,
      schedule_impact: "1-2 day delay expected",
    },
    recommendations: [
      "Complete security audit before deployment",
      "Add load testing to CI pipeline",
    ],
    next_steps: ["Schedule security review session", "Provision staging environment"],
  },
};

describe("SprintGateEvaluator", () => {
  const mockEvaluateGate = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(mockEvaluateGate);
  });

  it("renders loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Loading gate evaluation...")).toBeInTheDocument();
  });

  it("renders empty state with evaluate button when data is null", () => {
    mockUseQuery.mockReturnValue(null);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("No gate evaluation available")).toBeInTheDocument();
    expect(screen.getByText("Evaluate Gate")).toBeInTheDocument();
  });

  it("renders readiness percentage", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Overall Readiness")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("renders readiness with amber color for mid-range values", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    const readinessEl = screen.getByText("72%");
    expect(readinessEl.className).toContain("amber");
  });

  it("renders readiness with green color for high values", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        ...mockEvaluationData.evaluation,
        overall_readiness: 90,
      },
    });
    render(<SprintGateEvaluator {...defaultProps} />);
    const readinessEl = screen.getByText("90%");
    expect(readinessEl.className).toContain("green");
  });

  it("renders readiness with red color for low values", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        overall_readiness: 25,
      },
    });
    render(<SprintGateEvaluator {...defaultProps} />);
    const readinessEl = screen.getByText("25%");
    expect(readinessEl.className).toContain("red");
  });

  it("renders gate criteria with statuses", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Gate Criteria (3)")).toBeInTheDocument();
    expect(screen.getByText("Code Coverage")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(screen.getByText("Security Review")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("Performance Testing")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("renders criterion blockers", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Pending third-party audit")).toBeInTheDocument();
    expect(screen.getByText("Load tests not completed")).toBeInTheDocument();
    expect(screen.getByText("Missing staging environment")).toBeInTheDocument();
  });

  it("renders critical blockers with impact and resolution", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Critical Blockers (1)")).toBeInTheDocument();
    expect(screen.getByText("Staging environment not provisioned")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("~2 days")).toBeInTheDocument();
    expect(screen.getByText(/Request cloud resources from DevOps/)).toBeInTheDocument();
  });

  it("renders health assessment with verdict", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Health Assessment")).toBeInTheDocument();
    expect(screen.getByText("Conditional")).toBeInTheDocument();
    expect(
      screen.getByText("Sprint can proceed with conditions on security review completion"),
    ).toBeInTheDocument();
    expect(screen.getByText("Team Confidence")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
    expect(screen.getByText(/1-2 day delay expected/)).toBeInTheDocument();
  });

  it("renders verdict badge for ready state", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        ...mockEvaluationData.evaluation,
        health_assessment: {
          ...mockEvaluationData.evaluation.health_assessment,
          verdict: "ready",
        },
      },
    });
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders verdict badge for needs_work state", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        ...mockEvaluationData.evaluation,
        health_assessment: {
          ...mockEvaluationData.evaluation.health_assessment,
          verdict: "needs_work",
        },
      },
    });
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Needs Work")).toBeInTheDocument();
  });

  it("renders recommendations", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Complete security audit before deployment")).toBeInTheDocument();
    expect(screen.getByText("Add load testing to CI pipeline")).toBeInTheDocument();
  });

  it("renders next steps", () => {
    mockUseQuery.mockReturnValue(mockEvaluationData);
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("Next Steps")).toBeInTheDocument();
    expect(screen.getByText("Schedule security review session")).toBeInTheDocument();
    expect(screen.getByText("Provision staging environment")).toBeInTheDocument();
  });

  it("evaluate gate button calls action", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(null);
    render(<SprintGateEvaluator {...defaultProps} />);

    await user.click(screen.getByText("Evaluate Gate"));
    expect(mockEvaluateGate).toHaveBeenCalledWith({
      sprintId: "sprint123",
    });
  });

  it("shows evaluating state while action is running", async () => {
    const user = userEvent.setup();
    mockEvaluateGate.mockReturnValue(new Promise(() => {}));
    mockUseQuery.mockReturnValue(null);
    render(<SprintGateEvaluator {...defaultProps} />);

    await user.click(screen.getByText("Evaluate Gate"));
    expect(screen.getByText("Evaluating...")).toBeInTheDocument();
  });

  it("does not render optional sections when missing", () => {
    mockUseQuery.mockReturnValue({
      evaluation: {
        overall_readiness: 50,
      },
    });
    render(<SprintGateEvaluator {...defaultProps} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.queryByText(/Gate Criteria/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Critical Blockers/)).not.toBeInTheDocument();
    expect(screen.queryByText("Health Assessment")).not.toBeInTheDocument();
    expect(screen.queryByText("Recommendations")).not.toBeInTheDocument();
    expect(screen.queryByText("Next Steps")).not.toBeInTheDocument();
  });
});
