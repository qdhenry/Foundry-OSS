import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisRunTimeline } from "./AnalysisRunTimeline";

vi.mock("./AnalysisRunDetail", () => ({
  AnalysisRunDetail: () => <div data-testid="run-detail">RunDetail</div>,
}));

const makeRun = (overrides: any = {}) => ({
  _id: "run-1",
  status: "completed",
  scope: "workstream",
  config: { modelTier: "standard", confidenceThreshold: 90 },
  totalRequirements: 10,
  analyzedCount: 10,
  _creationTime: 1700000000000,
  ...overrides,
});

describe("AnalysisRunTimeline", () => {
  it("shows empty message when no runs", () => {
    render(<AnalysisRunTimeline runs={[]} />);
    expect(
      screen.getByText("No analysis runs yet. Configure and run your first analysis above."),
    ).toBeInTheDocument();
  });

  it("renders run items", () => {
    render(<AnalysisRunTimeline runs={[makeRun()]} />);
    expect(screen.getByText("Workstream Analysis")).toBeInTheDocument();
    expect(screen.getByText("standard")).toBeInTheDocument();
  });

  it("shows coverage when summary present", () => {
    const run = makeRun({
      summary: {
        fullyImplemented: 7,
        partiallyImplemented: 2,
        notFound: 1,
        needsVerification: 0,
        autoApplied: 9,
        pendingReview: 0,
      },
    });
    render(<AnalysisRunTimeline runs={[run]} />);
    expect(screen.getByText("90% coverage")).toBeInTheDocument();
  });

  it("expands run on click", async () => {
    const user = userEvent.setup();
    render(<AnalysisRunTimeline runs={[makeRun()]} />);
    await user.click(screen.getByText("Workstream Analysis"));
    expect(screen.getByTestId("run-detail")).toBeInTheDocument();
  });

  it("shows token cost", () => {
    const run = makeRun({ tokenUsage: { input: 1000, output: 500, cost: 0.12 } });
    render(<AnalysisRunTimeline runs={[run]} />);
    expect(screen.getByText("$0.12")).toBeInTheDocument();
  });
});
