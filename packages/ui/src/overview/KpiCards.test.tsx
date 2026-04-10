import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProgramStats, WorkstreamHealth } from "./KpiCards";
import { KpiCards } from "./KpiCards";

vi.mock(
  "@untitledui/icons",
  () =>
    new Proxy(
      {},
      {
        get: (_target, name) => {
          const Stub = (props: any) => <svg data-testid={`icon-${String(name)}`} {...props} />;
          Stub.displayName = String(name);
          return Stub;
        },
      },
    ),
);

vi.mock("../theme/useAnimations", () => ({
  useCountUp: vi.fn(),
}));

describe("KpiCards", () => {
  const defaultStats: ProgramStats = {
    totalRequirements: 100,
    completedRequirements: 45,
    completionPercent: 45,
    workstreamCount: 5,
    riskCount: 3,
    agentExecutionCount: 20,
  };

  const defaultHealth: WorkstreamHealth = {
    onTrack: 3,
    atRisk: 1,
    blocked: 1,
  };

  it("renders Requirement Completion card", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("Requirement Completion")).toBeInTheDocument();
  });

  it("renders Active Risks card", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("Active Risks")).toBeInTheDocument();
  });

  it("renders Workstream Health card", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("Workstream Health")).toBeInTheDocument();
  });

  it("renders Agent Executions card", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("Agent Executions")).toBeInTheDocument();
  });

  it("renders completion subtitle", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("45/100 completed")).toBeInTheDocument();
  });

  it("renders risk subtitle", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("3 open risks")).toBeInTheDocument();
  });

  it("renders total executions subtitle", () => {
    render(<KpiCards stats={defaultStats} workstreamHealth={defaultHealth} />);
    expect(screen.getByText("Total executions")).toBeInTheDocument();
  });
});
