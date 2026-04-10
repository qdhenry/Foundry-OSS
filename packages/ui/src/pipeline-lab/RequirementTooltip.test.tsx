import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequirementTooltip } from "./RequirementTooltip";

const mockReq = {
  id: "req-1",
  refId: "REQ-001",
  title: "Order Management",
  workstreamId: "ws-1",
  currentStage: "implementation" as const,
  health: "on_track" as const,
  priority: "must_have" as const,
  fitGap: "custom_dev" as const,
  effort: "high" as const,
  daysInStage: 5,
  stageHistory: [],
  aiRecommendation: "Consider splitting into subtasks",
};

describe("RequirementTooltip", () => {
  it("returns null when not visible", () => {
    const { container } = render(<RequirementTooltip requirement={mockReq} visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders requirement details when visible", () => {
    render(<RequirementTooltip requirement={mockReq} visible={true} />);
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("Order Management")).toBeInTheDocument();
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Custom Dev")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows days in stage", () => {
    render(<RequirementTooltip requirement={mockReq} visible={true} />);
    expect(screen.getByText("5d in stage")).toBeInTheDocument();
  });

  it("shows AI recommendation when present", () => {
    render(<RequirementTooltip requirement={mockReq} visible={true} />);
    expect(screen.getByText("Consider splitting into subtasks")).toBeInTheDocument();
  });

  it("omits AI recommendation when absent", () => {
    const noRec = { ...mockReq, aiRecommendation: undefined };
    render(<RequirementTooltip requirement={noRec} visible={true} />);
    expect(screen.queryByText("Consider splitting into subtasks")).not.toBeInTheDocument();
  });
});
