import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SprintCard } from "./SprintCard";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const baseSprint = {
  _id: "sprint-1",
  name: "Sprint Alpha",
  number: 1,
  status: "active" as const,
  startDate: new Date("2025-01-01").getTime(),
  endDate: new Date("2025-01-14").getTime(),
  goal: "Complete checkout flow implementation",
  workstreamId: "ws-1",
};

describe("SprintCard", () => {
  it("renders sprint name and number", () => {
    render(<SprintCard sprint={baseSprint} programId="prog-1" />);
    expect(screen.getByText("Sprint Alpha")).toBeInTheDocument();
    expect(screen.getByText("#1")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<SprintCard sprint={baseSprint} programId="prog-1" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders date range", () => {
    render(<SprintCard sprint={baseSprint} programId="prog-1" />);
    // Date formatting is locale-dependent; just check that date-like content exists
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it("renders goal text", () => {
    render(<SprintCard sprint={baseSprint} programId="prog-1" />);
    expect(screen.getByText("Complete checkout flow implementation")).toBeInTheDocument();
  });

  it("renders workstream name when provided", () => {
    render(<SprintCard sprint={baseSprint} programId="prog-1" workstreamName="Commerce" />);
    expect(screen.getByText("Commerce")).toBeInTheDocument();
  });

  it("links to sprint detail page", () => {
    render(<SprintCard sprint={baseSprint} programId="prog-1" />);
    expect(screen.getByText("Sprint Alpha").closest("a")).toHaveAttribute(
      "href",
      "/prog-1/sprints/sprint-1",
    );
  });

  it("renders planning status", () => {
    const sprint = { ...baseSprint, status: "planning" as const };
    render(<SprintCard sprint={sprint} programId="prog-1" />);
    expect(screen.getByText("Planning")).toBeInTheDocument();
  });

  it("renders completed status", () => {
    const sprint = { ...baseSprint, status: "completed" as const };
    render(<SprintCard sprint={sprint} programId="prog-1" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders cancelled status", () => {
    const sprint = { ...baseSprint, status: "cancelled" as const };
    render(<SprintCard sprint={sprint} programId="prog-1" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("handles missing goal gracefully", () => {
    const sprint = { ...baseSprint, goal: undefined };
    const { container } = render(<SprintCard sprint={sprint} programId="prog-1" />);
    expect(container.querySelector(".line-clamp-2")).toBeNull();
  });
});
