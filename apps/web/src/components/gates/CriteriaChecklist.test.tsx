import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CriteriaChecklist } from "./CriteriaChecklist";

const mockEvaluateCriterion = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockEvaluateCriterion,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sprintGates: {
      evaluateCriterion: "sprintGates:evaluateCriterion",
    },
  },
}));

function makeCriterion(overrides = {}) {
  return {
    title: "Unit tests pass",
    description: "All unit tests must pass",
    passed: false,
    evidence: undefined,
    ...overrides,
  };
}

describe("CriteriaChecklist", () => {
  beforeEach(() => {
    mockEvaluateCriterion.mockReset();
  });

  it("renders progress bar with 0%", () => {
    render(
      <CriteriaChecklist
        gateId="gate-1"
        criteria={[makeCriterion(), makeCriterion({ title: "Lint passes" })]}
        isEditable={false}
      />,
    );
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 passed (0%)")).toBeInTheDocument();
  });

  it("renders progress bar with 50%", () => {
    render(
      <CriteriaChecklist
        gateId="gate-1"
        criteria={[makeCriterion({ passed: true }), makeCriterion({ title: "Lint passes" })]}
        isEditable={false}
      />,
    );
    expect(screen.getByText("1 of 2 passed (50%)")).toBeInTheDocument();
  });

  it("renders progress bar with 100%", () => {
    render(
      <CriteriaChecklist
        gateId="gate-1"
        criteria={[
          makeCriterion({ passed: true }),
          makeCriterion({ title: "Lint passes", passed: true }),
        ]}
        isEditable={false}
      />,
    );
    expect(screen.getByText("2 of 2 passed (100%)")).toBeInTheDocument();
  });

  it("renders criterion titles", () => {
    render(
      <CriteriaChecklist
        gateId="gate-1"
        criteria={[makeCriterion(), makeCriterion({ title: "Lint passes" })]}
        isEditable={false}
      />,
    );
    expect(screen.getByText("Unit tests pass")).toBeInTheDocument();
    expect(screen.getByText("Lint passes")).toBeInTheDocument();
  });

  it("renders criterion descriptions", () => {
    render(<CriteriaChecklist gateId="gate-1" criteria={[makeCriterion()]} isEditable={false} />);
    expect(screen.getByText("All unit tests must pass")).toBeInTheDocument();
  });

  it("shows evidence input when editable", () => {
    render(<CriteriaChecklist gateId="gate-1" criteria={[makeCriterion()]} isEditable={true} />);
    expect(screen.getByPlaceholderText("Evidence link or note...")).toBeInTheDocument();
  });

  it("shows evidence text when not editable and evidence exists", () => {
    render(
      <CriteriaChecklist
        gateId="gate-1"
        criteria={[makeCriterion({ evidence: "https://example.com" })]}
        isEditable={false}
      />,
    );
    expect(screen.getByText("Evidence: https://example.com")).toBeInTheDocument();
  });

  it("calls evaluateCriterion when toggle is clicked", async () => {
    mockEvaluateCriterion.mockResolvedValue(undefined);
    render(<CriteriaChecklist gateId="gate-1" criteria={[makeCriterion()]} isEditable={true} />);
    const toggleButtons = screen.getAllByRole("button");
    // First button should be the toggle checkbox
    fireEvent.click(toggleButtons[0]);
    expect(mockEvaluateCriterion).toHaveBeenCalledWith({
      gateId: "gate-1",
      criterionIndex: 0,
      passed: true,
      evidence: undefined,
    });
  });

  it("disables toggle when not editable", () => {
    render(<CriteriaChecklist gateId="gate-1" criteria={[makeCriterion()]} isEditable={false} />);
    const toggleButtons = screen.getAllByRole("button");
    expect(toggleButtons[0]).toBeDisabled();
  });
});
