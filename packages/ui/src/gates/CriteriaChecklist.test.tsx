import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockEvaluateCriterion = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockEvaluateCriterion,
}));

import { CriteriaChecklist } from "./CriteriaChecklist";

const criteria = [
  {
    title: "Unit tests passing",
    description: "All unit tests green",
    passed: true,
    evidence: "CI link",
  },
  { title: "Code reviewed", passed: false },
  { title: "Performance benchmarks", description: "Under 200ms p95", passed: false },
];

describe("CriteriaChecklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders progress bar with correct count", () => {
    render(<CriteriaChecklist gateId="g1" criteria={criteria} isEditable={false} />);
    expect(screen.getByText("1 of 3 passed (33%)")).toBeInTheDocument();
  });

  it("renders all criteria titles", () => {
    render(<CriteriaChecklist gateId="g1" criteria={criteria} isEditable={false} />);
    expect(screen.getByText("Unit tests passing")).toBeInTheDocument();
    expect(screen.getByText("Code reviewed")).toBeInTheDocument();
    expect(screen.getByText("Performance benchmarks")).toBeInTheDocument();
  });

  it("renders descriptions when present", () => {
    render(<CriteriaChecklist gateId="g1" criteria={criteria} isEditable={false} />);
    expect(screen.getByText("All unit tests green")).toBeInTheDocument();
    expect(screen.getByText("Under 200ms p95")).toBeInTheDocument();
  });

  it("shows evidence text when not editable and evidence exists", () => {
    render(<CriteriaChecklist gateId="g1" criteria={criteria} isEditable={false} />);
    expect(screen.getByText("Evidence: CI link")).toBeInTheDocument();
  });

  it("shows evidence inputs when editable", () => {
    render(<CriteriaChecklist gateId="g1" criteria={criteria} isEditable={true} />);
    const inputs = screen.getAllByPlaceholderText("Evidence link or note...");
    expect(inputs).toHaveLength(3);
  });

  it("calls evaluateCriterion when toggle is clicked", () => {
    render(<CriteriaChecklist gateId="g1" criteria={criteria} isEditable={true} />);
    const toggleButtons = screen.getAllByRole("button");
    // First toggle button is for the first criterion (passed=true, should toggle to false)
    fireEvent.click(toggleButtons[0]);
    expect(mockEvaluateCriterion).toHaveBeenCalledWith({
      gateId: "g1",
      criterionIndex: 0,
      passed: false,
      evidence: "CI link",
    });
  });

  it("shows 100% progress when all criteria passed", () => {
    const allPassed = criteria.map((c) => ({ ...c, passed: true }));
    render(<CriteriaChecklist gateId="g1" criteria={allPassed} isEditable={false} />);
    expect(screen.getByText("3 of 3 passed (100%)")).toBeInTheDocument();
  });

  it("shows 0% progress when no criteria passed", () => {
    const nonePassed = criteria.map((c) => ({ ...c, passed: false }));
    render(<CriteriaChecklist gateId="g1" criteria={nonePassed} isEditable={false} />);
    expect(screen.getByText("0 of 3 passed (0%)")).toBeInTheDocument();
  });
});
