import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SprintCard } from "./SprintCard";

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("../programs", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

describe("SprintCard", () => {
  const defaultSprint = {
    _id: "sprint-1",
    name: "Sprint 3",
    number: 3,
    status: "active" as const,
    startDate: new Date("2026-03-01").getTime(),
    endDate: new Date("2026-03-14").getTime(),
    goal: "Complete auth module",
    workstreamId: "ws-1",
  };

  it("renders sprint name", () => {
    render(<SprintCard sprint={defaultSprint} programId="prog-1" />);
    expect(screen.getByText("Sprint 3")).toBeInTheDocument();
  });

  it("renders sprint number", () => {
    render(<SprintCard sprint={defaultSprint} programId="prog-1" />);
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders Active status badge", () => {
    render(<SprintCard sprint={defaultSprint} programId="prog-1" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders Planning status badge", () => {
    render(<SprintCard sprint={{ ...defaultSprint, status: "planning" }} programId="prog-1" />);
    expect(screen.getByText("Planning")).toBeInTheDocument();
  });

  it("renders sprint goal", () => {
    render(<SprintCard sprint={defaultSprint} programId="prog-1" />);
    expect(screen.getByText("Complete auth module")).toBeInTheDocument();
  });

  it("renders workstream name when provided", () => {
    render(<SprintCard sprint={defaultSprint} programId="prog-1" workstreamName="Auth Module" />);
    expect(screen.getByText("Auth Module")).toBeInTheDocument();
  });

  it("links to sprint detail page", () => {
    render(<SprintCard sprint={defaultSprint} programId="prog-1" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/test-program/sprints/sprint-1");
  });
});
