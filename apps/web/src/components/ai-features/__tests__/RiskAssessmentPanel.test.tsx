import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RiskAssessmentPanel } from "../RiskAssessmentPanel";

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
    riskAutogeneration: {
      getLatestAssessment: "riskAutogeneration:getLatestAssessment",
      requestRiskEvaluation: "riskAutogeneration:requestRiskEvaluation",
    },
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Shield: (props: Record<string, unknown>) => <span data-testid="icon-shield" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <span data-testid="icon-alert" {...props} />,
  TrendingUp: (props: Record<string, unknown>) => (
    <span data-testid="icon-trending-up" {...props} />
  ),
  Zap: (props: Record<string, unknown>) => <span data-testid="icon-zap" {...props} />,
  ChevronRight: ({ size, ...props }: Record<string, unknown>) => (
    <span data-testid="icon-chevron-right" {...props} />
  ),
}));

const defaultProps = {
  programId: "prog123" as any,
};

const mockAssessmentData = {
  assessment: {
    change_impact_summary: "Adding new payment gateway increases integration complexity.",
    new_risks: [
      {
        title: "Payment Data Exposure",
        severity: "critical",
        probability: "likely",
        description: "Sensitive payment data may be exposed during migration",
        mitigation: "Implement end-to-end encryption",
      },
      {
        title: "API Rate Limiting",
        severity: "medium",
        probability: "possible",
        description: "Third party API may throttle requests",
      },
    ],
    escalations: [
      {
        existing_risk_id: "RISK-001",
        new_severity: "high",
        rationale: "Scope increase makes this risk more likely",
      },
    ],
    cascade_impacts: [
      {
        impact_type: "schedule",
        description: "Payment integration delays affect checkout feature",
        affected_area: "Checkout workstream",
      },
    ],
    recommendations: [
      "Conduct security audit before go-live",
      "Set up API monitoring and alerting",
    ],
  },
};

describe("RiskAssessmentPanel", () => {
  const mockEvaluateRisks = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMutation.mockReturnValue(mockEvaluateRisks);
  });

  it("renders loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText("Loading risk assessment...")).toBeInTheDocument();
  });

  it("renders empty state with evaluate button when data is null", () => {
    mockUseQuery.mockReturnValue(null);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText("No risk assessment available")).toBeInTheDocument();
    expect(screen.getByText("Evaluate Risks")).toBeInTheDocument();
  });

  it("renders change impact summary", () => {
    mockUseQuery.mockReturnValue(mockAssessmentData);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText("Change Impact Summary")).toBeInTheDocument();
    expect(
      screen.getByText("Adding new payment gateway increases integration complexity."),
    ).toBeInTheDocument();
  });

  it("renders new risks with severity and probability badges", () => {
    mockUseQuery.mockReturnValue(mockAssessmentData);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText("New Risks (2)")).toBeInTheDocument();
    expect(screen.getByText("Payment Data Exposure")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("likely")).toBeInTheDocument();
    expect(
      screen.getByText("Sensitive payment data may be exposed during migration"),
    ).toBeInTheDocument();

    expect(screen.getByText("API Rate Limiting")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByText("possible")).toBeInTheDocument();
  });

  it("renders mitigation when provided", () => {
    mockUseQuery.mockReturnValue(mockAssessmentData);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText(/Implement end-to-end encryption/)).toBeInTheDocument();
  });

  it("renders escalations", () => {
    mockUseQuery.mockReturnValue(mockAssessmentData);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText("Escalations (1)")).toBeInTheDocument();
    expect(screen.getByText("RISK-001")).toBeInTheDocument();
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("Scope increase makes this risk more likely")).toBeInTheDocument();
  });

  it("renders cascade impacts", () => {
    mockUseQuery.mockReturnValue(mockAssessmentData);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText("Cascade Impacts (1)")).toBeInTheDocument();
    expect(screen.getByText("schedule")).toBeInTheDocument();
    expect(screen.getByText("Checkout workstream")).toBeInTheDocument();
    expect(
      screen.getByText("Payment integration delays affect checkout feature"),
    ).toBeInTheDocument();
  });

  it("renders recommendations", () => {
    mockUseQuery.mockReturnValue(mockAssessmentData);
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Conduct security audit before go-live")).toBeInTheDocument();
    expect(screen.getByText("Set up API monitoring and alerting")).toBeInTheDocument();
  });

  it("evaluate risks button calls action with defaults", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(null);
    render(<RiskAssessmentPanel {...defaultProps} />);

    await user.click(screen.getByText("Evaluate Risks"));
    expect(mockEvaluateRisks).toHaveBeenCalledWith({
      programId: "prog123",
      changeType: "manual_review",
    });
  });

  it("evaluate risks button uses provided changeType and changeContext", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue(null);
    render(
      <RiskAssessmentPanel
        {...defaultProps}
        changeType="requirement_added"
        changeContext="New payment requirement"
      />,
    );

    await user.click(screen.getByText("Evaluate Risks"));
    expect(mockEvaluateRisks).toHaveBeenCalledWith({
      programId: "prog123",
      changeType: "requirement_added",
    });
  });

  it("shows evaluating state while action is running", async () => {
    const user = userEvent.setup();
    mockEvaluateRisks.mockReturnValue(new Promise(() => {}));
    mockUseQuery.mockReturnValue(null);
    render(<RiskAssessmentPanel {...defaultProps} />);

    await user.click(screen.getByText("Evaluate Risks"));
    expect(screen.getByText("Evaluating...")).toBeInTheDocument();
  });

  it("does not render sections when data is empty", () => {
    mockUseQuery.mockReturnValue({
      assessment: {},
    });
    render(<RiskAssessmentPanel {...defaultProps} />);
    expect(screen.queryByText("Change Impact Summary")).not.toBeInTheDocument();
    expect(screen.queryByText(/New Risks/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Escalations/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cascade Impacts/)).not.toBeInTheDocument();
    expect(screen.queryByText("Recommendations")).not.toBeInTheDocument();
  });
});
