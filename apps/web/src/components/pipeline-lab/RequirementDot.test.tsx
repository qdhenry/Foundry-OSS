import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { MockRequirement } from "./pipeline-types";
import { RequirementDot } from "./RequirementDot";

const mockRequirement: MockRequirement = {
  id: "req-1",
  refId: "REQ-001",
  title: "User Authentication",
  workstreamId: "ws-1",
  currentStage: "implementation",
  health: "on_track",
  priority: "must_have",
  fitGap: "custom_dev",
  effort: "high",
  daysInStage: 3,
  stageHistory: [],
};

describe("RequirementDot", () => {
  it("renders with refId label", () => {
    render(
      <RequirementDot
        requirement={mockRequirement}
        workstreamColor="#3B82F6"
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

  it("applies workstream color as background", () => {
    render(
      <RequirementDot
        requirement={mockRequirement}
        workstreamColor="#3B82F6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveStyle({ backgroundColor: "#3B82F6" });
  });

  it("has accessible aria-label", () => {
    render(
      <RequirementDot
        requirement={mockRequirement}
        workstreamColor="#3B82F6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    expect(screen.getByLabelText("REQ-001: User Authentication")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <RequirementDot
        requirement={mockRequirement}
        workstreamColor="#3B82F6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={onClick}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("calls onHover on mouse enter/leave", async () => {
    const onHover = vi.fn();
    const user = userEvent.setup();
    render(
      <RequirementDot
        requirement={mockRequirement}
        workstreamColor="#3B82F6"
        isSelected={false}
        isDimmed={false}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={onHover}
        dotId="dot-1"
      />,
    );
    const button = screen.getByRole("button");
    await user.hover(button);
    expect(onHover).toHaveBeenCalledWith(true);
    await user.unhover(button);
    expect(onHover).toHaveBeenCalledWith(false);
  });

  it("applies dimmed opacity when isDimmed", () => {
    const { container } = render(
      <RequirementDot
        requirement={mockRequirement}
        workstreamColor="#3B82F6"
        isSelected={false}
        isDimmed={true}
        stackIndex={0}
        onClick={vi.fn()}
        onHover={vi.fn()}
        dotId="dot-1"
      />,
    );
    const button = container.querySelector("button");
    expect(button?.className).toContain("opacity-20");
  });
});
