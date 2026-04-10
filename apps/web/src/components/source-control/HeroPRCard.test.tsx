import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeroPRCard } from "./HeroPRCard";

let mockQueryReturn: any;
const mockMutationFn = vi.fn();
const mockActionFn = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockQueryReturn,
  useMutation: () => mockMutationFn,
  useAction: () => mockActionFn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      tasks: {
        prLifecycle: {
          getActiveHeroPR: "sourceControl.tasks.prLifecycle:getActiveHeroPR",
        },
        prActions: {
          promoteToReady: "sourceControl.tasks.prActions:promoteToReady",
          editDescription: "sourceControl.tasks.prActions:editDescription",
          requestReview: "sourceControl.tasks.prActions:requestReview",
          merge: "sourceControl.tasks.prActions:merge",
          close: "sourceControl.tasks.prActions:close",
          reopen: "sourceControl.tasks.prActions:reopen",
        },
        prActionsInternal: {
          triggerAIReview: "sourceControl.tasks.prActionsInternal:triggerAIReview",
          regenerateDescription: "sourceControl.tasks.prActionsInternal:regenerateDescription",
          getReviewerCandidates: "sourceControl.tasks.prActionsInternal:getReviewerCandidates",
        },
      },
    },
  },
}));

const mockPR = {
  _id: "pr-1",
  prNumber: 42,
  title: "feat: add checkout flow",
  state: "open" as const,
  isDraft: false,
  sourceBranch: "feat/checkout",
  targetBranch: "main",
  providerUrl: "https://github.com/org/repo/pull/42",
  ciStatus: "passing",
  reviewState: "approved",
  hasConflicts: false,
  additions: 150,
  deletions: 30,
  filesChanged: 8,
  reviews: [{ id: "r1" }],
  authorLogin: "dev1",
  body: "PR description",
  mergedAt: null,
};

describe("HeroPRCard", () => {
  it("shows loading skeleton when data is undefined", () => {
    mockQueryReturn = undefined;
    const { container } = render(<HeroPRCard taskId={"task-1" as any} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("returns null when no active PR", () => {
    mockQueryReturn = null;
    const { container } = render(<HeroPRCard taskId={"task-1" as any} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders PR number and title", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getByText("feat: add checkout flow")).toBeInTheDocument();
  });

  it("renders state badge for open PR", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders branch info", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("feat/checkout")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("renders CI status badge", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("CI passing")).toBeInTheDocument();
  });

  it("renders conflict state", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("No conflicts")).toBeInTheDocument();
  });

  it("shows conflict badge when hasConflicts is true", () => {
    mockQueryReturn = { ...mockPR, hasConflicts: true };
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("Conflicts")).toBeInTheDocument();
  });

  it("renders review count", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("1 review")).toBeInTheDocument();
  });

  it("renders file change stats", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("+150")).toBeInTheDocument();
    expect(screen.getByText("-30")).toBeInTheDocument();
    expect(screen.getByText("8 files")).toBeInTheDocument();
  });

  it("shows Draft badge and Promote button for draft PRs", () => {
    mockQueryReturn = { ...mockPR, isDraft: true };
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Promote to Ready")).toBeInTheDocument();
  });

  it("shows action buttons for non-merged PR", () => {
    mockQueryReturn = mockPR;
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("Edit Description")).toBeInTheDocument();
    expect(screen.getByText("Request Review")).toBeInTheDocument();
    expect(screen.getByText("AI Summary")).toBeInTheDocument();
    expect(screen.getByText("AI Review")).toBeInTheDocument();
    expect(screen.getByText("Merge")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  it("shows merged footer for merged PR", () => {
    mockQueryReturn = {
      ...mockPR,
      state: "merged",
      mergedAt: new Date("2026-03-15").getTime(),
    };
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("Merged")).toBeInTheDocument();
    expect(screen.getByText(/Merged by dev1/)).toBeInTheDocument();
  });

  it("shows Reopen button for closed PR", () => {
    mockQueryReturn = { ...mockPR, state: "closed" };
    render(<HeroPRCard taskId={"task-1" as any} />);
    expect(screen.getByText("Reopen")).toBeInTheDocument();
  });
});
