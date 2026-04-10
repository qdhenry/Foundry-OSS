import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequirementDot } from "./RequirementDot";

const baseReq = {
  id: "req-1",
  refId: "REQ-001",
  title: "Test Requirement",
  workstreamId: "ws-1",
  currentStage: "implementation" as const,
  health: "on_track" as const,
  priority: "must_have" as const,
  fitGap: "native" as const,
  effort: "low" as const,
  daysInStage: 3,
  stageHistory: [],
};

describe("RequirementDot", () => {
  it("renders the refId label", () => {
    render(
      <RequirementDot
        requirement={baseReq}
        workstreamColor="#3b82f6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
  });

  it("applies workstream color to the dot", () => {
    render(
      <RequirementDot
        requirement={baseReq}
        workstreamColor="#ef4444"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    const dot = screen.getByRole("button");
    expect(dot.style.backgroundColor).toBe("rgb(239, 68, 68)");
  });

  it("calls onClick when the dot is clicked", () => {
    const onClick = vi.fn();
    render(
      <RequirementDot
        requirement={baseReq}
        workstreamColor="#3b82f6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={onClick}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onHover on mouse enter/leave", () => {
    const onHover = vi.fn();
    render(
      <RequirementDot
        requirement={baseReq}
        workstreamColor="#3b82f6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={onHover}
        dotId="dot-1"
      />,
    );
    const dot = screen.getByRole("button");
    fireEvent.mouseEnter(dot);
    expect(onHover).toHaveBeenCalledWith(true);
    fireEvent.mouseLeave(dot);
    expect(onHover).toHaveBeenCalledWith(false);
  });

  it("applies dimmed opacity when isDimmed", () => {
    render(
      <RequirementDot
        requirement={baseReq}
        workstreamColor="#3b82f6"
        isSelected={false}
        isDimmed={true}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    const dot = screen.getByRole("button");
    expect(dot.className).toContain("opacity-20");
  });

  it("applies at_risk health ring", () => {
    const atRiskReq = { ...baseReq, health: "at_risk" as const };
    render(
      <RequirementDot
        requirement={atRiskReq}
        workstreamColor="#3b82f6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    const dot = screen.getByRole("button");
    expect(dot.className).toContain("ring-2");
    expect(dot.className).toContain("ring-amber-400");
  });
});
