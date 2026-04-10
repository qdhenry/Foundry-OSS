import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HealthScoreCard } from "./HealthScoreCard";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../theme/useAnimations", () => ({
  useCountUp: vi.fn(),
  useFadeIn: vi.fn(),
  useProgressBar: vi.fn(),
}));

describe("HealthScoreCard", () => {
  it("renders loading skeleton when data is undefined", () => {
    const { container } = render(
      <HealthScoreCard workstreamId="ws-1" workstreamName="Auth Module" />,
    );
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders no-data state when score is null", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(null);

    render(<HealthScoreCard workstreamId="ws-1" workstreamName="Auth Module" />);
    expect(screen.getByText("Auth Module")).toBeInTheDocument();
    expect(screen.getByText("No health data available yet")).toBeInTheDocument();
  });

  it("renders health score and status badge", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      health: "on_track",
      healthScore: 85,
      reasoning: "Strong velocity and low risk",
      factors: { velocityScore: 90, riskScore: 80 },
    });

    render(<HealthScoreCard workstreamId="ws-1" workstreamName="Auth Module" />);
    expect(screen.getByText("Auth Module")).toBeInTheDocument();
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("85/100")).toBeInTheDocument();
    expect(screen.getByText("Strong velocity and low risk")).toBeInTheDocument();
  });

  it("renders factor bars with labels", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      health: "at_risk",
      healthScore: 55,
      reasoning: "Task aging is high",
      factors: { velocityScore: 70, taskAgingScore: 40 },
    });

    render(<HealthScoreCard workstreamId="ws-1" workstreamName="Auth Module" />);
    expect(screen.getByText("Velocity")).toBeInTheDocument();
    expect(screen.getByText("Task Health")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();
  });

  it("renders change reason when present", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue({
      health: "blocked",
      healthScore: 20,
      reasoning: "Blocked by dependency",
      factors: {},
      changeReason: "Dependency blocker added",
    });

    render(<HealthScoreCard workstreamId="ws-1" workstreamName="Auth Module" />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Dependency blocker added")).toBeInTheDocument();
  });
});
