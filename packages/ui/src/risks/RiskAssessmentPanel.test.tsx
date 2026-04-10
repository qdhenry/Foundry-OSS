import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockEvaluateRisks = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => mockEvaluateRisks,
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="icon-alert" />,
  ChevronRight: () => <span data-testid="icon-chevron" />,
  Shield: () => <span data-testid="icon-shield" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Zap: () => <span data-testid="icon-zap" />,
}));

import { RiskAssessmentPanel } from "./RiskAssessmentPanel";

describe("RiskAssessmentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<RiskAssessmentPanel programId="p1" />);
    expect(screen.getByText("Loading risk assessment...")).toBeInTheDocument();
  });

  it("shows empty state with evaluate button when no data", () => {
    mockUseQuery.mockReturnValue(null);
    render(<RiskAssessmentPanel programId="p1" />);
    expect(screen.getByText("No risk assessment available")).toBeInTheDocument();
    expect(screen.getByText("Evaluate Risks")).toBeInTheDocument();
  });

  it("calls evaluateRisks on button click", () => {
    mockUseQuery.mockReturnValue(null);
    render(<RiskAssessmentPanel programId="p1" />);
    fireEvent.click(screen.getByText("Evaluate Risks"));
    expect(mockEvaluateRisks).toHaveBeenCalledWith({
      programId: "p1",
      changeType: "manual_review",
      changeContext: undefined,
    });
  });

  it("renders change impact summary as string", () => {
    mockUseQuery.mockReturnValue({
      assessment: {
        change_impact_summary: "High impact on data layer",
        new_risks: [],
        escalations: [],
        cascade_impacts: [],
        recommendations: [],
      },
    });
    render(<RiskAssessmentPanel programId="p1" />);
    expect(screen.getByText("Change Impact Summary")).toBeInTheDocument();
    expect(screen.getByText("High impact on data layer")).toBeInTheDocument();
  });

  it("renders new risks section", () => {
    mockUseQuery.mockReturnValue({
      assessment: {
        new_risks: [
          {
            title: "Performance Risk",
            severity: "high",
            probability: "likely",
            description: "Query latency may increase",
            mitigation: "Add caching",
          },
        ],
        escalations: [],
        cascade_impacts: [],
        recommendations: [],
      },
    });
    render(<RiskAssessmentPanel programId="p1" />);
    expect(screen.getByText("New Risks (1)")).toBeInTheDocument();
    expect(screen.getByText("Performance Risk")).toBeInTheDocument();
    expect(screen.getByText("Query latency may increase")).toBeInTheDocument();
  });

  it("renders recommendations", () => {
    mockUseQuery.mockReturnValue({
      assessment: {
        new_risks: [],
        escalations: [],
        cascade_impacts: [],
        recommendations: ["Add monitoring", "Increase test coverage"],
      },
    });
    render(<RiskAssessmentPanel programId="p1" />);
    expect(screen.getByText("Recommendations")).toBeInTheDocument();
    expect(screen.getByText("Add monitoring")).toBeInTheDocument();
    expect(screen.getByText("Increase test coverage")).toBeInTheDocument();
  });
});
