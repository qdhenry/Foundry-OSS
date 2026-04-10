import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CoverageDetail } from "./CoverageDetail";
import type { EnrichedExecution, RequirementSummary } from "./utils";

function makeExecution(overrides: Partial<EnrichedExecution> = {}): EnrichedExecution {
  return {
    _id: "exec-1",
    _creationTime: Date.now(),
    programId: "prog-1",
    taskType: "code_review",
    trigger: "manual",
    reviewStatus: "accepted",
    requirementId: "req-1",
    ...overrides,
  };
}

function makeReq(overrides: Partial<RequirementSummary> = {}): RequirementSummary {
  return {
    _id: "req-1",
    refId: "REQ-001",
    title: "Auth Flow",
    workstreamId: "ws-1",
    ...overrides,
  } as RequirementSummary;
}

describe("CoverageDetail", () => {
  const defaultProps = {
    executions: [makeExecution()],
    requirements: [makeReq(), makeReq({ _id: "req-2", refId: "REQ-002", title: "Billing" })],
    workstreamNames: new Map([["ws-1", "Auth Module"]]),
    onBack: vi.fn(),
  };

  it("renders back button", () => {
    render(<CoverageDetail {...defaultProps} />);
    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });

  it("calls onBack when back button clicked", async () => {
    const onBack = vi.fn();
    render(<CoverageDetail {...defaultProps} onBack={onBack} />);
    await userEvent.click(screen.getByText("Back to Dashboard"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders coverage summary count", () => {
    render(<CoverageDetail {...defaultProps} />);
    expect(screen.getByText("1/2 requirements have agent activity")).toBeInTheDocument();
  });

  it("renders workstream name as heading", () => {
    render(<CoverageDetail {...defaultProps} />);
    expect(screen.getByText("Auth Module")).toBeInTheDocument();
  });

  it("renders workstream covered count", () => {
    render(<CoverageDetail {...defaultProps} />);
    expect(screen.getByText("1/2 covered")).toBeInTheDocument();
  });

  it("renders requirement ref IDs", () => {
    render(<CoverageDetail {...defaultProps} />);
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("REQ-002")).toBeInTheDocument();
  });

  it("renders covered requirement with run count", () => {
    render(<CoverageDetail {...defaultProps} />);
    expect(screen.getByText("1 run")).toBeInTheDocument();
  });

  it("renders uncovered requirement with no activity", () => {
    render(<CoverageDetail {...defaultProps} />);
    expect(screen.getByText("No activity")).toBeInTheDocument();
  });

  it("renders Unassigned for requirements without workstream", () => {
    render(
      <CoverageDetail
        {...defaultProps}
        requirements={[makeReq({ workstreamId: undefined })]}
        workstreamNames={new Map()}
      />,
    );
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });
});
