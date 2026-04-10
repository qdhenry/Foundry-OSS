import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamGrid } from "./WorkstreamGrid";

vi.mock("convex/react", () => ({
  useQuery: () => null,
}));

vi.mock("./WorkstreamHealthPanel", () => ({
  WorkstreamHealthPanel: ({ workstreamName, open }: any) =>
    open ? <div data-testid="health-panel">{workstreamName}</div> : null,
}));

const workstreams = [
  { _id: "ws-1", name: "Frontend", shortCode: "FE", status: "on_track" as const },
  { _id: "ws-2", name: "Backend", shortCode: "BE", status: "at_risk" as const },
];

describe("WorkstreamGrid", () => {
  it("renders empty state when no workstreams", () => {
    render(<WorkstreamGrid workstreams={[]} programId="prog_1" />);
    expect(screen.getByText("No workstreams created yet.")).toBeInTheDocument();
  });

  it("renders workstream cards", () => {
    render(<WorkstreamGrid workstreams={workstreams} programId="prog_1" />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("renders short codes", () => {
    render(<WorkstreamGrid workstreams={workstreams} programId="prog_1" />);
    expect(screen.getByText("FE")).toBeInTheDocument();
    expect(screen.getByText("BE")).toBeInTheDocument();
  });

  it("renders status labels", () => {
    render(<WorkstreamGrid workstreams={workstreams} programId="prog_1" />);
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();
  });

  it("opens health panel on card click", () => {
    render(<WorkstreamGrid workstreams={workstreams} programId="prog_1" />);
    fireEvent.click(screen.getByText("Frontend"));
    expect(screen.getByTestId("health-panel")).toBeInTheDocument();
  });
});
