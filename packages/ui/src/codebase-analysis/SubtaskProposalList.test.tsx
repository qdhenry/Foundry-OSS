import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SubtaskProposalList } from "./SubtaskProposalList";

describe("SubtaskProposalList", () => {
  it("shows empty message when no proposals", () => {
    render(
      <SubtaskProposalList
        proposals={[]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBulkApprove={vi.fn()}
      />,
    );
    expect(screen.getByText("No subtask changes proposed.")).toBeInTheDocument();
  });

  it("renders proposal type labels", () => {
    const proposals = [
      {
        _id: "p1",
        proposalType: "status_change",
        proposedState: { status: "done" },
        reasoning: "Tests pass",
        evidence: { files: [] },
        reviewStatus: "pending",
      },
      {
        _id: "p2",
        proposalType: "new_subtask",
        proposedState: { title: "Add index" },
        reasoning: "Missing index",
        evidence: { files: [] },
        reviewStatus: "pending",
      },
    ];
    render(
      <SubtaskProposalList
        proposals={proposals}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBulkApprove={vi.fn()}
      />,
    );
    expect(screen.getByText("Status Change")).toBeInTheDocument();
    expect(screen.getByText("New Subtask")).toBeInTheDocument();
  });

  it("shows bulk approve button when multiple pending", () => {
    const proposals = [
      {
        _id: "p1",
        proposalType: "status_change",
        proposedState: {},
        reasoning: "r1",
        evidence: { files: [] },
        reviewStatus: "pending",
      },
      {
        _id: "p2",
        proposalType: "rewrite",
        proposedState: {},
        reasoning: "r2",
        evidence: { files: [] },
        reviewStatus: "pending",
      },
    ];
    render(
      <SubtaskProposalList
        proposals={proposals}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBulkApprove={vi.fn()}
      />,
    );
    expect(screen.getByText("Approve All (2)")).toBeInTheDocument();
  });

  it("shows approved/rejected badges", () => {
    const proposals = [
      {
        _id: "p1",
        proposalType: "status_change",
        proposedState: {},
        reasoning: "done",
        evidence: { files: [] },
        reviewStatus: "approved",
      },
      {
        _id: "p2",
        proposalType: "rewrite",
        proposedState: {},
        reasoning: "nope",
        evidence: { files: [] },
        reviewStatus: "rejected",
      },
    ];
    render(
      <SubtaskProposalList
        proposals={proposals}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onBulkApprove={vi.fn()}
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("calls onApprove when approve clicked", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const proposals = [
      {
        _id: "p1",
        proposalType: "status_change",
        proposedState: {},
        reasoning: "r",
        evidence: { files: [] },
        reviewStatus: "pending",
      },
    ];
    render(
      <SubtaskProposalList
        proposals={proposals}
        onApprove={onApprove}
        onReject={vi.fn()}
        onBulkApprove={vi.fn()}
      />,
    );
    await user.click(screen.getByTitle("Approve"));
    expect(onApprove).toHaveBeenCalledWith("p1");
  });
});
