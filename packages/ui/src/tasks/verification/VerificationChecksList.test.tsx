import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationChecksList } from "./VerificationChecksList";

const MOCK_CHECKS = [
  {
    _id: "chk-1",
    type: "visual",
    description: "Homepage matches design mockup",
    status: "passed" as const,
  },
  {
    _id: "chk-2",
    type: "functional",
    description: "Login form submits correctly",
    status: "failed" as const,
    expected: "Redirect to dashboard",
    actual: "Stayed on login page",
    aiExplanation: "The form action URL is misconfigured.",
  },
  {
    _id: "chk-3",
    type: "accessibility",
    description: "Color contrast meets WCAG AA",
    status: "warning" as const,
  },
];

describe("VerificationChecksList", () => {
  it("renders check descriptions", () => {
    render(<VerificationChecksList checks={MOCK_CHECKS} />);
    expect(screen.getByText("Homepage matches design mockup")).toBeInTheDocument();
    expect(screen.getByText("Login form submits correctly")).toBeInTheDocument();
    expect(screen.getByText("Color contrast meets WCAG AA")).toBeInTheDocument();
  });

  it("shows type badges", () => {
    render(<VerificationChecksList checks={MOCK_CHECKS} />);
    expect(screen.getByText("Visual")).toBeInTheDocument();
    expect(screen.getByText("Functional")).toBeInTheDocument();
    expect(screen.getByText("A11y")).toBeInTheDocument();
  });

  it("shows header with check count", () => {
    render(<VerificationChecksList checks={MOCK_CHECKS} />);
    expect(screen.getByText("Checks (3)")).toBeInTheDocument();
  });

  it("shows expected and actual for failed checks", () => {
    render(<VerificationChecksList checks={MOCK_CHECKS} />);
    expect(screen.getByText("Redirect to dashboard")).toBeInTheDocument();
    expect(screen.getByText("Stayed on login page")).toBeInTheDocument();
  });

  it("does not show expected/actual for passing checks", () => {
    const passingOnly = [MOCK_CHECKS[0]];
    render(<VerificationChecksList checks={passingOnly} />);
    expect(screen.queryByText(/Expected:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Actual:/)).not.toBeInTheDocument();
  });

  it("shows AI explanation when present", () => {
    render(<VerificationChecksList checks={MOCK_CHECKS} />);
    expect(screen.getByText("The form action URL is misconfigured.")).toBeInTheDocument();
  });

  it("returns null for empty checks array", () => {
    const { container } = render(<VerificationChecksList checks={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
