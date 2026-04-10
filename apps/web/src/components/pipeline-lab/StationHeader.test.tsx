import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StationHeader } from "./StationHeader";

const mockStage = {
  id: "implementation" as const,
  label: "Implementation",
  shortLabel: "Impl",
  order: 4,
};

describe("StationHeader", () => {
  it("renders short label in circle", () => {
    render(<StationHeader stage={mockStage} count={3} isHighlighted={false} onClick={vi.fn()} />);
    const labels = screen.getAllByText("Impl");
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders count badge", () => {
    render(<StationHeader stage={mockStage} count={3} isHighlighted={false} onClick={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<StationHeader stage={mockStage} count={3} isHighlighted={false} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies highlight ring when isHighlighted is true", () => {
    const { container } = render(
      <StationHeader stage={mockStage} count={3} isHighlighted={true} onClick={vi.fn()} />,
    );
    const circle = container.querySelector(".ring-2.ring-blue-500");
    expect(circle).not.toBeNull();
  });

  it("applies bottleneck animation when count >= 4", () => {
    const { container } = render(
      <StationHeader stage={mockStage} count={4} isHighlighted={false} onClick={vi.fn()} />,
    );
    const circle = container.querySelector(".ring-2.ring-amber-400");
    expect(circle).not.toBeNull();
  });

  it("shows zero count without special styling", () => {
    render(<StationHeader stage={mockStage} count={0} isHighlighted={false} onClick={vi.fn()} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
