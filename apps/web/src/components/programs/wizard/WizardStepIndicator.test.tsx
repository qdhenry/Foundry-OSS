import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WizardStepIndicator } from "./WizardStepIndicator";

const STEPS = ["Basics", "Upload", "Analysis", "Review", "Launch"];

describe("WizardStepIndicator", () => {
  it("renders all step labels", () => {
    render(<WizardStepIndicator steps={STEPS} currentStep={0} completedSteps={[]} />);

    for (const label of STEPS) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders step numbers for non-completed steps", () => {
    render(<WizardStepIndicator steps={STEPS} currentStep={2} completedSteps={[]} />);

    // All 5 steps should show their number
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("renders checkmark for completed steps instead of number", () => {
    render(<WizardStepIndicator steps={STEPS} currentStep={2} completedSteps={[0, 1]} />);

    // Completed steps (0, 1) should NOT show their numbers
    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();

    // Non-completed steps should still show numbers
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("applies current step styling to the active step", () => {
    const { container } = render(
      <WizardStepIndicator steps={STEPS} currentStep={1} completedSteps={[]} />,
    );

    // The second step circle (index 1) should have the current styling (border-amber-600)
    const circles = container.querySelectorAll(
      "div.flex.h-8.w-8.items-center.justify-center.rounded-full",
    );
    expect(circles[1].className).toContain("border-amber-600");
  });

  it("applies completed step styling with amber background", () => {
    const { container } = render(
      <WizardStepIndicator steps={STEPS} currentStep={2} completedSteps={[0, 1]} />,
    );

    const circles = container.querySelectorAll(
      "div.flex.h-8.w-8.items-center.justify-center.rounded-full",
    );
    // First two should have completed styling
    expect(circles[0].className).toContain("bg-amber-500");
    expect(circles[1].className).toContain("bg-amber-500");
    // Third should be current
    expect(circles[2].className).toContain("border-amber-600");
  });

  it("renders connector lines between steps but not after the last", () => {
    const { container } = render(
      <WizardStepIndicator steps={STEPS} currentStep={0} completedSteps={[]} />,
    );

    // There should be 4 connector lines (between 5 steps)
    const connectors = container.querySelectorAll("div.mx-2.h-0\\.5.w-full");
    expect(connectors).toHaveLength(4);
  });

  it("colors connector lines amber for completed steps", () => {
    const { container } = render(
      <WizardStepIndicator steps={STEPS} currentStep={3} completedSteps={[0, 1, 2]} />,
    );

    const connectors = container.querySelectorAll("div.mx-2.h-0\\.5.w-full");
    // First three connectors should be completed (amber)
    expect(connectors[0].className).toContain("bg-amber-500");
    expect(connectors[1].className).toContain("bg-amber-500");
    expect(connectors[2].className).toContain("bg-amber-500");
    // Fourth connector should be default (slate)
    expect(connectors[3].className).toContain("bg-slate-200");
  });
});
