import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExecutionOutput } from "./ExecutionOutput";

const mockUpdateReview = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => mockUpdateReview),
}));

describe("ExecutionOutput", () => {
  const defaultProps = {
    executionId: "exec-1",
    output: "Generated auth middleware",
    reviewStatus: "pending" as const,
  };

  it("renders output text", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("Generated auth middleware")).toBeInTheDocument();
  });

  it("renders Pending Review badge for pending status", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });

  it("renders Accepted badge", () => {
    render(<ExecutionOutput {...defaultProps} reviewStatus="accepted" />);
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("renders Rejected badge", () => {
    render(<ExecutionOutput {...defaultProps} reviewStatus="rejected" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("renders skill name when provided", () => {
    render(<ExecutionOutput {...defaultProps} skillName="Code Review" />);
    expect(screen.getByText("Code Review")).toBeInTheDocument();
  });

  it("renders token count when provided", () => {
    render(<ExecutionOutput {...defaultProps} tokensUsed={1500} />);
    expect(screen.getByText("1,500 tokens")).toBeInTheDocument();
  });

  it("renders duration when provided", () => {
    render(<ExecutionOutput {...defaultProps} durationMs={12500} />);
    expect(screen.getByText("12.5s")).toBeInTheDocument();
  });

  it("renders review action buttons for pending status", () => {
    render(<ExecutionOutput {...defaultProps} />);
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Revise")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("hides review buttons for accepted status", () => {
    render(<ExecutionOutput {...defaultProps} reviewStatus="accepted" />);
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
  });

  it("calls mutation on Accept click", async () => {
    mockUpdateReview.mockResolvedValue(undefined);
    render(<ExecutionOutput {...defaultProps} />);
    await userEvent.click(screen.getByText("Accept"));
    expect(mockUpdateReview).toHaveBeenCalledWith({
      executionId: "exec-1",
      reviewStatus: "accepted",
    });
  });
});
