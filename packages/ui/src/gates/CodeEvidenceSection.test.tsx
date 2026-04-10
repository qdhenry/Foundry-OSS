import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

import { CodeEvidenceSection } from "./CodeEvidenceSection";

describe("CodeEvidenceSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no sprintId", () => {
    const { container } = render(<CodeEvidenceSection gateId="g1" programId="p1" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<CodeEvidenceSection gateId="g1" sprintId="s1" programId="p1" />);
    expect(screen.getByText("Loading code evidence...")).toBeInTheDocument();
  });

  it("shows empty state when no PRs and all deployments inactive", () => {
    mockUseQuery.mockReturnValue({
      totalPRs: 0,
      deploymentStatus: [{ status: "inactive" }],
    });
    render(<CodeEvidenceSection gateId="g1" sprintId="s1" programId="p1" />);
    expect(screen.getByText(/No source control data available/)).toBeInTheDocument();
  });

  it("renders PR merge progress", () => {
    mockUseQuery.mockReturnValue({
      totalPRs: 10,
      mergedPRs: 7,
      openPRs: 3,
      prMergeCompletionPct: 70,
      ciBranchStatus: "passing",
      reviewCoveragePct: 80,
      reviewedPRCount: 8,
      unresolvedReviewComments: 2,
      forcePushCount: 0,
      hasHighRiskRequirements: false,
      deploymentStatus: [
        { status: "success", environment: "staging", deployedAt: Date.now(), sha: "abc" },
      ],
    });
    render(<CodeEvidenceSection gateId="g1" sprintId="s1" programId="p1" />);
    expect(screen.getByText("PR Merge Completion")).toBeInTheDocument();
    expect(screen.getByText("7/10 merged (70%)")).toBeInTheDocument();
    expect(screen.getByText("3 PRs still open")).toBeInTheDocument();
  });

  it("renders CI status badge", () => {
    mockUseQuery.mockReturnValue({
      totalPRs: 5,
      mergedPRs: 5,
      openPRs: 0,
      prMergeCompletionPct: 100,
      ciBranchStatus: "passing",
      reviewCoveragePct: 100,
      reviewedPRCount: 5,
      unresolvedReviewComments: 0,
      forcePushCount: 0,
      hasHighRiskRequirements: false,
      deploymentStatus: [{ status: "inactive" }],
    });
    render(<CodeEvidenceSection gateId="g1" sprintId="s1" programId="p1" />);
    expect(screen.getByText("Passing")).toBeInTheDocument();
  });

  it("shows high risk badge when applicable", () => {
    mockUseQuery.mockReturnValue({
      totalPRs: 1,
      mergedPRs: 1,
      openPRs: 0,
      prMergeCompletionPct: 100,
      ciBranchStatus: "passing",
      reviewCoveragePct: 100,
      reviewedPRCount: 1,
      unresolvedReviewComments: 0,
      forcePushCount: 0,
      hasHighRiskRequirements: true,
      deploymentStatus: [{ status: "inactive" }],
    });
    render(<CodeEvidenceSection gateId="g1" sprintId="s1" programId="p1" />);
    expect(screen.getByText("High Risk")).toBeInTheDocument();
  });

  it("renders deployment status", () => {
    mockUseQuery.mockReturnValue({
      totalPRs: 1,
      mergedPRs: 1,
      openPRs: 0,
      prMergeCompletionPct: 100,
      ciBranchStatus: "passing",
      reviewCoveragePct: 100,
      reviewedPRCount: 1,
      unresolvedReviewComments: 0,
      forcePushCount: 0,
      hasHighRiskRequirements: false,
      deploymentStatus: [
        { status: "success", environment: "staging", deployedAt: Date.now(), sha: "abc" },
        { status: "failure", environment: "production", deployedAt: null, sha: null },
      ],
    });
    render(<CodeEvidenceSection gateId="g1" sprintId="s1" programId="p1" />);
    expect(screen.getByText("Deployment Status")).toBeInTheDocument();
    expect(screen.getByText("staging")).toBeInTheDocument();
    expect(screen.getByText("Deployed")).toBeInTheDocument();
    expect(screen.getByText("production")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
