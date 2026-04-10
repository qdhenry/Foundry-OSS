import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationStatusBadge } from "./VerificationStatusBadge";

describe("VerificationStatusBadge", () => {
  it("renders 'Pending' for pending status", () => {
    render(<VerificationStatusBadge status="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders 'Provisioning' for provisioning status", () => {
    render(<VerificationStatusBadge status="provisioning" />);
    expect(screen.getByText("Provisioning")).toBeInTheDocument();
  });

  it("renders 'Running' for running status", () => {
    render(<VerificationStatusBadge status="running" />);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("renders pass count for completed status with counts", () => {
    render(<VerificationStatusBadge status="completed" checksPassed={3} checksTotal={5} />);
    expect(screen.getByText("3/5 passed")).toBeInTheDocument();
  });

  it("renders issue count (plural) for completed with multiple failures", () => {
    render(
      <VerificationStatusBadge
        status="completed"
        checksPassed={3}
        checksTotal={5}
        checksFailed={2}
      />,
    );
    expect(screen.getByText("2 issues")).toBeInTheDocument();
  });

  it("renders issue count (singular) for completed with one failure", () => {
    render(
      <VerificationStatusBadge
        status="completed"
        checksPassed={4}
        checksTotal={5}
        checksFailed={1}
      />,
    );
    expect(screen.getByText("1 issue")).toBeInTheDocument();
  });

  it("renders 'Failed' for failed status", () => {
    render(<VerificationStatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders 'Cancelled' for cancelled status", () => {
    render(<VerificationStatusBadge status="cancelled" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});
