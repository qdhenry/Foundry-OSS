import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StationHeader } from "./StationHeader";

const stage = {
  id: "implementation" as const,
  label: "Implementation",
  shortLabel: "IMP",
  order: 5,
};

describe("StationHeader", () => {
  it("renders the short label and count", () => {
    render(<StationHeader stage={stage} count={3} isHighlighted={false} onClick={vi.fn()} />);
    expect(screen.getAllByText("IMP").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the full label", () => {
    render(<StationHeader stage={stage} count={0} isHighlighted={false} onClick={vi.fn()} />);
    expect(screen.getByText("Implementation")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<StationHeader stage={stage} count={1} isHighlighted={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies highlight ring when isHighlighted", () => {
    render(<StationHeader stage={stage} count={1} isHighlighted={true} onClick={vi.fn()} />);
    const circleEl = screen.getAllByText("IMP")[0];
    expect(circleEl.className).toContain("ring-2");
    expect(circleEl.className).toContain("ring-blue-500");
  });

  it("applies bottleneck animation when count >= 4", () => {
    render(<StationHeader stage={stage} count={5} isHighlighted={false} onClick={vi.fn()} />);
    const circleEl = screen.getAllByText("IMP")[0];
    expect(circleEl.className).toContain("ring-amber-400");
    expect(circleEl.className).toContain("animate-pulse");
  });

  it("shows info badge style for non-zero count", () => {
    render(<StationHeader stage={stage} count={2} isHighlighted={false} onClick={vi.fn()} />);
    const countBadge = screen.getByText("2");
    expect(countBadge.className).toContain("bg-status-info-bg");
  });
});
