import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequirementStatusBars } from "./RequirementStatusBars";

const statusCounts = {
  draft: 10,
  approved: 20,
  in_progress: 15,
  complete: 30,
  deferred: 5,
  total: 80,
};

const priorityCounts = {
  must_have: 25,
  should_have: 20,
  nice_to_have: 10,
  deferred: 5,
  total: 60,
};

describe("RequirementStatusBars", () => {
  it("renders By Status and By Priority headings", () => {
    render(<RequirementStatusBars statusCounts={statusCounts} priorityCounts={priorityCounts} />);
    expect(screen.getByText("By Status")).toBeInTheDocument();
    expect(screen.getByText("By Priority")).toBeInTheDocument();
  });

  it("shows total counts in headings", () => {
    render(<RequirementStatusBars statusCounts={statusCounts} priorityCounts={priorityCounts} />);
    expect(screen.getByText("(80 total)")).toBeInTheDocument();
    expect(screen.getByText("(60 total)")).toBeInTheDocument();
  });

  it("renders legend items for status segments", () => {
    render(<RequirementStatusBars statusCounts={statusCounts} priorityCounts={priorityCounts} />);
    expect(screen.getByText("Draft (10)")).toBeInTheDocument();
    expect(screen.getByText("Approved (20)")).toBeInTheDocument();
    expect(screen.getByText("In Progress (15)")).toBeInTheDocument();
    expect(screen.getByText("Complete (30)")).toBeInTheDocument();
  });

  it("renders legend items for priority segments", () => {
    render(<RequirementStatusBars statusCounts={statusCounts} priorityCounts={priorityCounts} />);
    expect(screen.getByText("Must Have (25)")).toBeInTheDocument();
    expect(screen.getByText("Should Have (20)")).toBeInTheDocument();
    expect(screen.getByText("Nice to Have (10)")).toBeInTheDocument();
  });

  it("handles undefined counts gracefully", () => {
    render(<RequirementStatusBars statusCounts={undefined} priorityCounts={undefined} />);
    expect(screen.getAllByText("(0 total)").length).toBe(2);
    expect(screen.getByText("Draft (0)")).toBeInTheDocument();
  });
});
