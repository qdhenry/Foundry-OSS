import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkstreamGrid } from "./WorkstreamGrid";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    workstreamDependencies: {
      listByProgram: "workstreamDependencies:listByProgram",
    },
  },
}));

describe("WorkstreamGrid", () => {
  it("shows empty state when no workstreams", () => {
    render(<WorkstreamGrid workstreams={[]} programId={"prog-1" as any} />);
    expect(screen.getByText("No workstreams created yet.")).toBeInTheDocument();
  });

  it("renders workstream cards", () => {
    const workstreams = [
      { _id: "ws-1" as any, name: "Frontend", shortCode: "FE", status: "on_track" as const },
      { _id: "ws-2" as any, name: "Backend", shortCode: "BE", status: "at_risk" as const },
    ];
    render(<WorkstreamGrid workstreams={workstreams} programId={"prog-1" as any} />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("FE")).toBeInTheDocument();
    expect(screen.getByText("BE")).toBeInTheDocument();
  });

  it("displays status labels", () => {
    const workstreams = [
      { _id: "ws-1" as any, name: "WS 1", shortCode: "W1", status: "on_track" as const },
      { _id: "ws-2" as any, name: "WS 2", shortCode: "W2", status: "blocked" as const },
    ];
    render(<WorkstreamGrid workstreams={workstreams} programId={"prog-1" as any} />);
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("shows sprint number", () => {
    const workstreams = [
      {
        _id: "ws-1" as any,
        name: "WS",
        shortCode: "W",
        status: "on_track" as const,
        currentSprint: 3,
      },
    ];
    render(<WorkstreamGrid workstreams={workstreams} programId={"prog-1" as any} />);
    expect(screen.getByText("Sprint 3")).toBeInTheDocument();
  });

  it("defaults to Sprint 1 when no currentSprint", () => {
    const workstreams = [
      { _id: "ws-1" as any, name: "WS", shortCode: "W", status: "on_track" as const },
    ];
    render(<WorkstreamGrid workstreams={workstreams} programId={"prog-1" as any} />);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("links to workstream detail page", () => {
    const workstreams = [
      { _id: "ws-1" as any, name: "WS", shortCode: "W", status: "on_track" as const },
    ];
    render(<WorkstreamGrid workstreams={workstreams} programId={"prog-1" as any} />);
    expect(screen.getByText("WS").closest("a")).toHaveAttribute("href", "/prog-1/workstreams/ws-1");
  });
});
