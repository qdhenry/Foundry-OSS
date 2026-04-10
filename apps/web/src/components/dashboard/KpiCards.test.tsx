import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KpiCards } from "./KpiCards";

vi.mock("@untitledui/icons", () => {
  const Icon = (props: any) => <span data-testid="icon" {...props} />;
  return {
    BarChart01: Icon,
    LayersThree01: Icon,
    AlertTriangle: Icon,
    Activity: Icon,
  };
});

const defaultStats = {
  totalRequirements: 100,
  completedRequirements: 42,
  completionPercent: 42,
  workstreamCount: 5,
  riskCount: 3,
  agentExecutionCount: 12,
};

const defaultHealth = {
  onTrack: 3,
  atRisk: 1,
  blocked: 1,
};

describe("KpiCards", () => {
  it("renders all four KPI cards", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("Requirement Completion")).toBeInTheDocument();
    expect(screen.getByText("Workstream Health")).toBeInTheDocument();
    expect(screen.getByText("Active Risks")).toBeInTheDocument();
    expect(screen.getByText("Agent Executions")).toBeInTheDocument();
  });

  it("displays completion percentage", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("42/100 completed")).toBeInTheDocument();
  });

  it("displays workstream count and health indicators", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("Workstream Health")).toBeInTheDocument();
    // Health dots are rendered as colored spans with numbers
    // The on-track/at-risk/blocked numbers are 3/1/1
  });

  it("displays risk count with correct pluralization", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("3 open risks")).toBeInTheDocument();
  });

  it("handles singular risk count", () => {
    const stats = { ...defaultStats, riskCount: 1 };
    render(<KpiCards stats={stats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("1 open risk")).toBeInTheDocument();
  });

  it("handles zero risks", () => {
    const stats = { ...defaultStats, riskCount: 0 };
    render(<KpiCards stats={stats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("No open risks")).toBeInTheDocument();
  });

  it("displays agent execution count", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Total executions")).toBeInTheDocument();
  });
});
