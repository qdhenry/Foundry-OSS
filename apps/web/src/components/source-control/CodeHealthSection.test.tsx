import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeHealthSection } from "./CodeHealthSection";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      health: {
        codeHealthSignals: {
          getForProgram: "sourceControl.health.codeHealthSignals:getForProgram",
        },
      },
    },
  },
}));

describe("CodeHealthSection", () => {
  it("shows loading skeleton when data is undefined", () => {
    mockQueryReturn = undefined;
    const { container } = render(<CodeHealthSection programId={"prog-1" as any} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.getByText("Code Health")).toBeInTheDocument();
  });

  it("shows empty state when repoCount is 0", () => {
    mockQueryReturn = { repoCount: 0 };
    render(<CodeHealthSection programId={"prog-1" as any} />);
    expect(
      screen.getByText("Connect repositories in Settings to see code health metrics"),
    ).toBeInTheDocument();
  });

  it("renders KPI cards with data", () => {
    mockQueryReturn = {
      repoCount: 2,
      commitCount7d: 42,
      prsMerged7d: 8,
      prsAwaitingReview: 2,
      ciPassRate: 95,
      compositeScore: 85,
      singleAuthorWarning: false,
    };
    render(<CodeHealthSection programId={"prog-1" as any} />);
    expect(screen.getByText("Commits this week")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("PRs merged")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("PRs awaiting review")).toBeInTheDocument();
    expect(screen.getByText("CI pass rate")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("shows composite score badge", () => {
    mockQueryReturn = {
      repoCount: 1,
      commitCount7d: 10,
      prsMerged7d: 3,
      prsAwaitingReview: 0,
      ciPassRate: 100,
      compositeScore: 92,
      singleAuthorWarning: false,
    };
    render(<CodeHealthSection programId={"prog-1" as any} />);
    expect(screen.getByText("Score: 92/100")).toBeInTheDocument();
  });

  it("shows single author warning when flagged", () => {
    mockQueryReturn = {
      repoCount: 1,
      commitCount7d: 20,
      prsMerged7d: 5,
      prsAwaitingReview: 1,
      ciPassRate: 80,
      compositeScore: 60,
      singleAuthorWarning: true,
    };
    render(<CodeHealthSection programId={"prog-1" as any} />);
    expect(screen.getByText(/Single-author concentration detected/)).toBeInTheDocument();
  });

  it("does not show single author warning when not flagged", () => {
    mockQueryReturn = {
      repoCount: 1,
      commitCount7d: 20,
      prsMerged7d: 5,
      prsAwaitingReview: 1,
      ciPassRate: 80,
      compositeScore: 60,
      singleAuthorWarning: false,
    };
    render(<CodeHealthSection programId={"prog-1" as any} />);
    expect(screen.queryByText(/Single-author concentration/)).not.toBeInTheDocument();
  });

  it("renders commit velocity bar chart", () => {
    mockQueryReturn = {
      repoCount: 1,
      commitCount7d: 14,
      prsMerged7d: 2,
      prsAwaitingReview: 0,
      ciPassRate: 100,
      compositeScore: 90,
      singleAuthorWarning: false,
    };
    render(<CodeHealthSection programId={"prog-1" as any} />);
    expect(screen.getByText("Commit Velocity (last 7 days)")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });
});
