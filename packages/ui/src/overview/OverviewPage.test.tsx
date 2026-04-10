import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./OverviewPage";

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../mission-control/DailyDigest", () => ({
  DailyDigest: () => <div data-testid="daily-digest" />,
}));

vi.mock("../mission-control/DependencySuggestions", () => ({
  DependencySuggestions: () => <div data-testid="dependency-suggestions" />,
}));

vi.mock("../mission-control/PipelineProgressWidget", () => ({
  PipelineProgressWidget: () => <div data-testid="pipeline-progress" />,
}));

vi.mock("../theme/useAnimations", () => ({
  useFadeIn: vi.fn(),
}));

vi.mock("./KpiCards", () => ({
  KpiCards: () => <div data-testid="kpi-cards" />,
}));

vi.mock("./WorkstreamGrid", () => ({
  WorkstreamGrid: () => <div data-testid="workstream-grid" />,
}));

const program = {
  phase: "build" as const,
  status: "active" as const,
  name: "Test Program",
  clientName: "Test Client",
  stats: {
    totalRequirements: 10,
    agentExecutionCount: 5,
    completionPercent: 50,
    workstreamCount: 3,
    riskCount: 1,
  },
};

describe("OverviewPage", () => {
  it("renders Mission Control heading", () => {
    render(<OverviewPage program={program as any} programId="prog_1" programSlug="test-program" />);
    expect(screen.getByText("Mission Control")).toBeInTheDocument();
  });

  it("renders phase badge", () => {
    render(<OverviewPage program={program as any} programId="prog_1" programSlug="test-program" />);
    expect(screen.getByText("build")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<OverviewPage program={program as any} programId="prog_1" programSlug="test-program" />);
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders program name and client", () => {
    render(<OverviewPage program={program as any} programId="prog_1" programSlug="test-program" />);
    expect(screen.getByText("Test Program - Test Client")).toBeInTheDocument();
  });

  it("renders KPI cards", () => {
    render(<OverviewPage program={program as any} programId="prog_1" programSlug="test-program" />);
    expect(screen.getByTestId("kpi-cards")).toBeInTheDocument();
  });

  it("shows onboarding when program is empty", () => {
    const emptyProgram = {
      ...program,
      stats: { ...program.stats, totalRequirements: 0, agentExecutionCount: 0 },
    };
    render(
      <OverviewPage program={emptyProgram as any} programId="prog_1" programSlug="test-program" />,
    );
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
  });
});
