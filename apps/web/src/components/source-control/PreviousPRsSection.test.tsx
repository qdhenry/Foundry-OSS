import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PreviousPRsSection } from "./PreviousPRsSection";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      tasks: {
        prLifecycle: {
          getStackedPRs: "sourceControl.tasks.prLifecycle:getStackedPRs",
        },
      },
    },
  },
}));

const mockPRs = [
  {
    _id: "pr-active",
    prNumber: 10,
    title: "Active PR",
    state: "open",
    isDraft: false,
    sourceBranch: "feat/active",
    targetBranch: "main",
    commitCount: 3,
    filesChanged: 5,
    additions: 100,
    deletions: 20,
    providerUrl: "https://github.com/org/repo/pull/10",
  },
  {
    _id: "pr-prev-1",
    prNumber: 8,
    title: "Previous merged PR",
    state: "merged",
    isDraft: false,
    sourceBranch: "feat/old",
    targetBranch: "main",
    commitCount: 2,
    filesChanged: 3,
    additions: 50,
    deletions: 10,
    providerUrl: "https://github.com/org/repo/pull/8",
  },
  {
    _id: "pr-prev-2",
    prNumber: 6,
    title: "Closed draft PR",
    state: "closed",
    isDraft: true,
    sourceBranch: "feat/draft",
    targetBranch: "main",
    commitCount: 1,
    filesChanged: 1,
    additions: 5,
    deletions: 0,
    providerUrl: null,
  },
];

describe("PreviousPRsSection", () => {
  it("shows loading skeleton when data is undefined", () => {
    mockQueryReturn = undefined;
    const { container } = render(
      <PreviousPRsSection taskId={"task-1" as any} activePrId={"pr-active" as any} />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("returns null when no previous PRs after filtering active", () => {
    mockQueryReturn = [mockPRs[0]]; // only the active PR
    const { container } = render(
      <PreviousPRsSection taskId={"task-1" as any} activePrId={"pr-active" as any} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders header with previous PR count", () => {
    mockQueryReturn = mockPRs;
    render(<PreviousPRsSection taskId={"task-1" as any} activePrId={"pr-active" as any} />);
    expect(screen.getByText("Previous PRs")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders PR numbers and titles", () => {
    mockQueryReturn = mockPRs;
    render(<PreviousPRsSection taskId={"task-1" as any} activePrId={"pr-active" as any} />);
    expect(screen.getByText("#8")).toBeInTheDocument();
    expect(screen.getByText("Previous merged PR")).toBeInTheDocument();
    expect(screen.getByText("#6")).toBeInTheDocument();
    expect(screen.getByText("Closed draft PR")).toBeInTheDocument();
  });

  it("shows state badges for PRs", () => {
    mockQueryReturn = mockPRs;
    render(<PreviousPRsSection taskId={"task-1" as any} activePrId={"pr-active" as any} />);
    expect(screen.getByText("Merged")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("expands PR row to show branch and stats on click", async () => {
    mockQueryReturn = mockPRs;
    const user = userEvent.setup();
    render(<PreviousPRsSection taskId={"task-1" as any} activePrId={"pr-active" as any} />);

    await user.click(screen.getByText("Previous merged PR"));
    expect(screen.getByText("feat/old")).toBeInTheDocument();
    expect(screen.getByText("2 commits")).toBeInTheDocument();
    expect(screen.getByText("3 files")).toBeInTheDocument();
    expect(screen.getByText("View on GitHub →")).toBeInTheDocument();
  });

  it("collapses section on header click", async () => {
    mockQueryReturn = mockPRs;
    const user = userEvent.setup();
    render(<PreviousPRsSection taskId={"task-1" as any} activePrId={"pr-active" as any} />);
    expect(screen.getByText("#8")).toBeInTheDocument();

    await user.click(screen.getByText("Previous PRs"));
    expect(screen.queryByText("#8")).not.toBeInTheDocument();
  });
});
