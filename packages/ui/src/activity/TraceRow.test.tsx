import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TraceRow } from "./TraceRow";
import type { EnrichedExecution } from "./utils";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("./TraceDetailSections", () => ({
  OutputSection: ({ output }: any) => <div data-testid="output-section">{output}</div>,
  CostSection: () => <div data-testid="cost-section" />,
  CodeChangesSection: () => <div data-testid="code-changes" />,
  SubtaskSection: () => <div data-testid="subtask-section" />,
  LogsSection: () => <div data-testid="logs-section" />,
  ReviewSection: () => <div data-testid="review-section" />,
}));

function makeExecution(overrides: Partial<EnrichedExecution> = {}): EnrichedExecution {
  return {
    _id: "exec-1",
    _creationTime: Date.now(),
    programId: "prog-1",
    taskType: "code_review",
    trigger: "manual",
    reviewStatus: "pending",
    tokensUsed: 5000,
    durationMs: 12500,
    inputSummary: "Review the auth module",
    ...overrides,
  };
}

describe("TraceRow", () => {
  it("renders task type label", () => {
    render(<TraceRow execution={makeExecution()} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Code Review")).toBeInTheDocument();
  });

  it("renders input summary when not rejected", () => {
    render(<TraceRow execution={makeExecution()} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Review the auth module")).toBeInTheDocument();
  });

  it("renders output summary for rejected executions", () => {
    render(
      <TraceRow
        execution={makeExecution({
          reviewStatus: "rejected",
          outputSummary: "Failed validation",
        })}
        isExpanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Failed validation")).toBeInTheDocument();
  });

  it("renders token count", () => {
    render(<TraceRow execution={makeExecution()} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("5.0K")).toBeInTheDocument();
  });

  it("renders duration in seconds", () => {
    render(<TraceRow execution={makeExecution()} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("12.5s")).toBeInTheDocument();
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = vi.fn();
    render(<TraceRow execution={makeExecution()} isExpanded={false} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("renders expanded detail section when isExpanded", () => {
    render(<TraceRow execution={makeExecution()} isExpanded={true} onToggle={vi.fn()} />);
    expect(screen.getByTestId("output-section")).toBeInTheDocument();
  });

  it("does not render expanded section when collapsed", () => {
    render(<TraceRow execution={makeExecution()} isExpanded={false} onToggle={vi.fn()} />);
    expect(screen.queryByTestId("output-section")).not.toBeInTheDocument();
  });

  it("renders trigger badge in expanded view", () => {
    render(<TraceRow execution={makeExecution()} isExpanded={true} onToggle={vi.fn()} />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("renders fallback text when no summary available", () => {
    render(
      <TraceRow
        execution={makeExecution({ inputSummary: undefined })}
        isExpanded={false}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("No summary available")).toBeInTheDocument();
  });
});
