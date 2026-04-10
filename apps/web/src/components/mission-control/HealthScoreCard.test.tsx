import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockHealthScore: any;

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
  useQuery: () => mockHealthScore,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    healthScoring: {
      getLatestHealthScore: "healthScoring:getLatestHealthScore",
    },
  },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

import { HealthScoreCard } from "./HealthScoreCard";

const defaultProps = {
  workstreamId: "ws-1" as any,
  workstreamName: "Checkout Flow",
};

const mockOnTrackScore = {
  _id: "score-1",
  health: "on_track",
  healthScore: 85,
  reasoning: "Good velocity with minor concerns",
  factors: {
    velocityScore: 90,
    taskAgingScore: 80,
    riskScore: 75,
    gatePassRate: 100,
    dependencyScore: 85,
  },
  changeReason: null,
};

const mockAtRiskScore = {
  _id: "score-2",
  health: "at_risk",
  healthScore: 55,
  reasoning: "Velocity dropping and risks increasing",
  factors: {
    velocityScore: 50,
    taskAgingScore: 60,
    riskScore: 45,
    gatePassRate: 70,
    dependencyScore: 55,
  },
  changeReason: "Velocity dropped 20% this sprint",
};

const mockBlockedScore = {
  _id: "score-3",
  health: "blocked",
  healthScore: 25,
  reasoning: "Critical dependency blocking all progress",
  factors: {
    velocityScore: 10,
    taskAgingScore: 30,
    riskScore: 20,
    gatePassRate: 40,
    dependencyScore: 15,
  },
  changeReason: null,
};

describe("HealthScoreCard", () => {
  beforeEach(() => {
    mockHealthScore = undefined;
  });

  it("shows loading skeleton when query returns undefined", () => {
    mockHealthScore = undefined;
    const { container } = render(<HealthScoreCard {...defaultProps} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    expect(screen.queryByText("Checkout Flow")).not.toBeInTheDocument();
  });

  it("shows no data message when query returns null", () => {
    mockHealthScore = null;
    render(<HealthScoreCard {...defaultProps} />);
    expect(screen.getByText("Checkout Flow")).toBeInTheDocument();
    expect(screen.getByText("No health data available yet")).toBeInTheDocument();
  });

  it("shows green On Track badge for on_track health", () => {
    mockHealthScore = mockOnTrackScore;
    render(<HealthScoreCard {...defaultProps} />);
    const badge = screen.getByText("On Track");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-800");
  });

  it("shows amber At Risk badge for at_risk health", () => {
    mockHealthScore = mockAtRiskScore;
    render(<HealthScoreCard {...defaultProps} />);
    const badge = screen.getByText("At Risk");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-amber-100");
    expect(badge.className).toContain("text-amber-800");
  });

  it("shows red Blocked badge for blocked health", () => {
    mockHealthScore = mockBlockedScore;
    render(<HealthScoreCard {...defaultProps} />);
    const badge = screen.getByText("Blocked");
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain("bg-red-100");
    expect(badge.className).toContain("text-red-800");
  });

  it("displays healthScore out of 100", () => {
    mockHealthScore = mockOnTrackScore;
    render(<HealthScoreCard {...defaultProps} />);
    // 85/100 appears both as main score and Dependencies factor score
    const matches = screen.getAllByText("85/100");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The main score is in a bold span
    const mainScore = matches.find((el) => el.className.includes("font-bold"));
    expect(mainScore).toBeTruthy();
  });

  it("displays reasoning text", () => {
    mockHealthScore = mockOnTrackScore;
    render(<HealthScoreCard {...defaultProps} />);
    expect(screen.getByText("Good velocity with minor concerns")).toBeInTheDocument();
  });

  it("shows all 5 factor labels with scores", () => {
    mockHealthScore = mockOnTrackScore;
    render(<HealthScoreCard {...defaultProps} />);

    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText("90")).toBeInTheDocument();

    expect(screen.getByText("Task Health")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();

    expect(screen.getByText("Risk Level")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument();

    expect(screen.getByText("Gate Pass Rate")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();

    expect(screen.getByText("Dependencies")).toBeInTheDocument();
    // 85 is shown both as main score (85/100) and as dependency factor score
    expect(screen.getByText("85")).toBeInTheDocument();
  });

  it("shows change reason when present", () => {
    mockHealthScore = mockAtRiskScore;
    render(<HealthScoreCard {...defaultProps} />);
    expect(screen.getByText("Change:")).toBeInTheDocument();
    expect(screen.getByText("Velocity dropped 20% this sprint")).toBeInTheDocument();
  });

  it("does not show change section when changeReason is null", () => {
    mockHealthScore = mockOnTrackScore;
    render(<HealthScoreCard {...defaultProps} />);
    expect(screen.queryByText("Change:")).not.toBeInTheDocument();
  });

  it("displays workstream name in header when data present", () => {
    mockHealthScore = mockOnTrackScore;
    render(<HealthScoreCard {...defaultProps} />);
    expect(screen.getByText("Checkout Flow")).toBeInTheDocument();
  });
});
