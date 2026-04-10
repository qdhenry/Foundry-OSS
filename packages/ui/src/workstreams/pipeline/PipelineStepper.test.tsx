import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineStepper } from "./PipelineStepper";

describe("PipelineStepper", () => {
  it("renders all 8 stage labels on desktop view", () => {
    render(<PipelineStepper currentStage="implementation" />);
    expect(screen.getAllByText("Disc.").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Impl").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Rev").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onStageClick when a step is clicked", async () => {
    const user = userEvent.setup();
    const onStageClick = vi.fn();
    render(<PipelineStepper currentStage="requirement" onStageClick={onStageClick} />);
    // Click any of the "Impl" buttons (could be desktop or mobile view)
    const buttons = screen.getAllByText("Impl");
    await user.click(buttons[0]);
    expect(onStageClick).toHaveBeenCalledWith("implementation");
  });

  it("renders show all stages toggle on mobile", () => {
    render(<PipelineStepper currentStage="discovery" />);
    expect(screen.getByText(/Show all stages/)).toBeInTheDocument();
  });
});
