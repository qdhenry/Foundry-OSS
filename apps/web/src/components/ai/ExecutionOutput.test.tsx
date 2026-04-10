import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutionOutput } from "./ExecutionOutput";

const mockUpdateReview = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateReview,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    agentExecutions: {
      updateReview: "agentExecutions:updateReview",
    },
  },
}));

describe("ExecutionOutput", () => {
  beforeEach(() => {
    mockUpdateReview.mockReset();
    mockUpdateReview.mockResolvedValue(undefined);
  });

  const defaultProps = {
    executionId: "exec-1",
    output: "Generated tax calculation module with 3 functions",
    skillName: "Tax Logic",
    tokensUsed: 2000,
    durationMs: 3200,
    reviewStatus: "pending" as const,
  };

  it("renders output text", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(
      screen.getByText("Generated tax calculation module with 3 functions"),
    ).toBeInTheDocument();
  });

  it("renders skill name badge", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("Tax Logic")).toBeInTheDocument();
  });

  it("renders token count", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("2,000 tokens")).toBeInTheDocument();
  });

  it("renders duration", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("3.2s")).toBeInTheDocument();
  });

  it("renders review status badge", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });

  it("shows review action buttons for pending status", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Revise")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("calls updateReview with accepted on Accept click", async () => {
    const user = userEvent.setup();
    render(<ExecutionOutput {...defaultProps} />);
    await user.click(screen.getByText("Accept"));
    expect(mockUpdateReview).toHaveBeenCalledWith({
      executionId: "exec-1",
      reviewStatus: "accepted",
    });
  });

  it("calls updateReview with revised on Revise click", async () => {
    const user = userEvent.setup();
    render(<ExecutionOutput {...defaultProps} />);
    await user.click(screen.getByText("Revise"));
    expect(mockUpdateReview).toHaveBeenCalledWith({
      executionId: "exec-1",
      reviewStatus: "revised",
    });
  });

  it("calls updateReview with rejected on Reject click", async () => {
    const user = userEvent.setup();
    render(<ExecutionOutput {...defaultProps} />);
    await user.click(screen.getByText("Reject"));
    expect(mockUpdateReview).toHaveBeenCalledWith({
      executionId: "exec-1",
      reviewStatus: "rejected",
    });
  });

  it("hides action buttons for accepted status", () => {
    render(<ExecutionOutput {...defaultProps} reviewStatus="accepted" />);
    expect(screen.queryByText("Accept")).toBeNull();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("hides action buttons for rejected status", () => {
    render(<ExecutionOutput {...defaultProps} reviewStatus="rejected" />);
    expect(screen.queryByText("Accept")).toBeNull();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });
});
