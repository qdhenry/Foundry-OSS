import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PreviousPRsSection } from "./PreviousPRsSection";

let queryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

function makePR(overrides = {}) {
  return {
    _id: "pr-1",
    prNumber: 42,
    title: "feat: add auth",
    state: "merged",
    isDraft: false,
    sourceBranch: "feature/auth",
    targetBranch: "main",
    commitCount: 3,
    filesChanged: 5,
    additions: 100,
    deletions: 20,
    providerUrl: "https://github.com/org/repo/pull/42",
    ...overrides,
  };
}

describe("PreviousPRsSection", () => {
  it("renders header", () => {
    queryReturn = undefined;
    render(<PreviousPRsSection taskId="task-1" />);
    expect(screen.getByText("Previous PRs")).toBeInTheDocument();
  });

  it("shows loading skeleton when data undefined", () => {
    queryReturn = undefined;
    const { container } = render(<PreviousPRsSection taskId="task-1" />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("returns null when no previous PRs after filtering", () => {
    queryReturn = [makePR({ _id: "active-pr" })];
    const { container } = render(<PreviousPRsSection taskId="task-1" activePrId="active-pr" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders PR number and title", () => {
    queryReturn = [makePR()];
    render(<PreviousPRsSection taskId="task-1" />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("feat: add auth")).toBeInTheDocument();
  });

  it("renders merged state badge", () => {
    queryReturn = [makePR()];
    render(<PreviousPRsSection taskId="task-1" />);
    expect(screen.getByText("Merged")).toBeInTheDocument();
  });

  it("renders draft state badge", () => {
    queryReturn = [makePR({ isDraft: true })];
    render(<PreviousPRsSection taskId="task-1" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("filters out active PR", () => {
    queryReturn = [
      makePR({ _id: "active" }),
      makePR({ _id: "old", prNumber: 40, title: "old PR" }),
    ];
    render(<PreviousPRsSection taskId="task-1" activePrId="active" />);
    expect(screen.queryByText("#42")).not.toBeInTheDocument();
    expect(screen.getByText("#40")).toBeInTheDocument();
  });

  it("shows PR count", () => {
    queryReturn = [makePR(), makePR({ _id: "pr-2", prNumber: 41, title: "fix: typo" })];
    render(<PreviousPRsSection taskId="task-1" />);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("expands PR details on click", () => {
    queryReturn = [makePR()];
    render(<PreviousPRsSection taskId="task-1" />);
    fireEvent.click(screen.getByText("feat: add auth"));
    expect(screen.getByText("feature/auth")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("3 commits")).toBeInTheDocument();
    expect(screen.getByText("5 files")).toBeInTheDocument();
    expect(screen.getByText("+100")).toBeInTheDocument();
    expect(screen.getByText("-20")).toBeInTheDocument();
    expect(screen.getByText("View on GitHub →")).toBeInTheDocument();
  });
});
