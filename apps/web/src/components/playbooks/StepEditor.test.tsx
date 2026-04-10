import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StepEditor } from "./StepEditor";

const mockWorkstreams = [
  { _id: "ws-1" as any, name: "Data Migration", shortCode: "DM" },
  { _id: "ws-2" as any, name: "Integration", shortCode: "INT" },
];

const mockSteps = [
  {
    title: "Discovery",
    description: "Gather requirements.",
    workstreamId: "ws-1" as any,
    estimatedHours: 40,
  },
  { title: "Data Mapping", description: undefined, workstreamId: undefined, estimatedHours: 80 },
];

describe("StepEditor", () => {
  it("renders step titles", () => {
    render(<StepEditor steps={mockSteps} onChange={vi.fn()} workstreams={mockWorkstreams} />);
    expect(screen.getByDisplayValue("Discovery")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Data Mapping")).toBeInTheDocument();
  });

  it("renders add step button", () => {
    render(<StepEditor steps={mockSteps} onChange={vi.fn()} workstreams={mockWorkstreams} />);
    expect(screen.getByText(/Add Step/)).toBeInTheDocument();
  });

  it("calls onChange when add step is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<StepEditor steps={mockSteps} onChange={onChange} workstreams={mockWorkstreams} />);
    await user.click(screen.getByText(/Add Step/));
    expect(onChange).toHaveBeenCalledWith([...mockSteps, { title: "" }]);
  });

  it("renders step count", () => {
    render(<StepEditor steps={mockSteps} onChange={vi.fn()} workstreams={mockWorkstreams} />);
    expect(screen.getByText(/2 steps/i)).toBeInTheDocument();
  });

  it("renders empty state with no steps", () => {
    render(<StepEditor steps={[]} onChange={vi.fn()} workstreams={mockWorkstreams} />);
    expect(screen.getByText(/Add Step/)).toBeInTheDocument();
  });
});
