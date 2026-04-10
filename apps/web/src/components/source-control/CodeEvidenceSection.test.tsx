import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CodeEvidenceSection } from "./CodeEvidenceSection";

let mockQueryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: (_fn: any, args: any) => {
    if (args === "skip") return undefined;
    return mockQueryReturn;
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      gates: {
        codeEvidence: {
          assembleCodeEvidence: "sourceControl.gates.codeEvidence:assembleCodeEvidence",
        },
      },
    },
  },
}));

const mockEvidence = {
  totalPRs: 5,
  mergedPRs: 3,
  openPRs: 2,
  prMergeCompletionPct: 60,
  ciBranchStatus: "passing",
  reviewCoveragePct: 80,
  reviewedPRCount: 4,
  unresolvedReviewComments: 1,
  forcePushCount: 0,
  hasHighRiskRequirements: false,
  deploymentStatus: [
    { environment: "staging", status: "success", deployedAt: Date.now(), sha: "abc123" },
    { environment: "production", status: "inactive", deployedAt: null, sha: null },
  ],
};

describe("CodeEvidenceSection", () => {
  it("returns null when no sprintId is provided", () => {
    const { container } = render(
      <CodeEvidenceSection gateId={"gate-1" as any} programId={"prog-1" as any} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows loading text when data is undefined", () => {
    mockQueryReturn = undefined;
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("Loading code evidence...")).toBeInTheDocument();
  });

  it("shows empty state when no PRs and all deployments inactive", () => {
    mockQueryReturn = {
      totalPRs: 0,
      deploymentStatus: [{ status: "inactive" }],
    };
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText(/No source control data available/)).toBeInTheDocument();
  });

  it("renders PR merge completion progress", () => {
    mockQueryReturn = mockEvidence;
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("PR Merge Completion")).toBeInTheDocument();
    expect(screen.getByText("3/5 merged (60%)")).toBeInTheDocument();
  });

  it("shows open PRs warning", () => {
    mockQueryReturn = mockEvidence;
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("2 PRs still open")).toBeInTheDocument();
  });

  it("renders CI status badge", () => {
    mockQueryReturn = mockEvidence;
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("Passing")).toBeInTheDocument();
  });

  it("renders review coverage percentage", () => {
    mockQueryReturn = mockEvidence;
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("4/5 PRs reviewed")).toBeInTheDocument();
  });

  it("renders unresolved comments count", () => {
    mockQueryReturn = mockEvidence;
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("shows high risk badge when flagged", () => {
    mockQueryReturn = { ...mockEvidence, hasHighRiskRequirements: true };
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("High Risk")).toBeInTheDocument();
  });

  it("renders deployment status for active environments", () => {
    mockQueryReturn = mockEvidence;
    render(
      <CodeEvidenceSection
        gateId={"gate-1" as any}
        sprintId={"sprint-1" as any}
        programId={"prog-1" as any}
      />,
    );
    expect(screen.getByText("Deployment Status")).toBeInTheDocument();
    expect(screen.getByText("staging")).toBeInTheDocument();
  });
});
