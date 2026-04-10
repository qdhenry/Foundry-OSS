import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationSummary } from "./VerificationSummary";

const BASE_PROPS = {
  checksTotal: 5,
  checksPassed: 4,
  checksFailed: 1,
  screenshotCount: 3,
};

describe("VerificationSummary", () => {
  it("shows passed count", () => {
    render(<VerificationSummary {...BASE_PROPS} />);
    expect(screen.getByText("4 passed")).toBeInTheDocument();
  });

  it("shows failed count when greater than zero", () => {
    render(<VerificationSummary {...BASE_PROPS} checksFailed={2} />);
    expect(screen.getByText("2 failed")).toBeInTheDocument();
  });

  it("hides failed section when checksFailed is zero", () => {
    render(<VerificationSummary {...BASE_PROPS} checksFailed={0} />);
    expect(screen.queryByText(/failed/)).not.toBeInTheDocument();
  });

  it("shows screenshot count", () => {
    render(<VerificationSummary {...BASE_PROPS} />);
    expect(screen.getByText("3 screenshots")).toBeInTheDocument();
  });

  it("formats duration as seconds when under 60s", () => {
    render(<VerificationSummary {...BASE_PROPS} durationMs={30000} />);
    expect(screen.getByText("30s")).toBeInTheDocument();
  });

  it("formats duration as minutes and seconds when 60s or more", () => {
    render(<VerificationSummary {...BASE_PROPS} durationMs={135000} />);
    expect(screen.getByText("2m 15s")).toBeInTheDocument();
  });

  it("shows AI summary text when provided", () => {
    render(
      <VerificationSummary {...BASE_PROPS} aiSummary="All critical paths verified successfully." />,
    );
    expect(screen.getByText("AI Analysis")).toBeInTheDocument();
    expect(screen.getByText("All critical paths verified successfully.")).toBeInTheDocument();
  });

  it("hides AI summary section when not provided", () => {
    render(<VerificationSummary {...BASE_PROPS} />);
    expect(screen.queryByText("AI Analysis")).not.toBeInTheDocument();
  });
});
