import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MockRequirement } from "./pipeline-types";
import { RequirementTooltip } from "./RequirementTooltip";

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
  daysInStage: 5,
  stageHistory: [],
  aiRecommendation: "Consider breaking into subtasks",
};

describe("RequirementTooltip", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <RequirementTooltip requirement={mockRequirement} visible={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders refId and title when visible", () => {
    render(<RequirementTooltip requirement={mockRequirement} visible={true} />);
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("User Authentication")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<RequirementTooltip requirement={mockRequirement} visible={true} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
  });

  it("renders fit/gap badge", () => {
    render(<RequirementTooltip requirement={mockRequirement} visible={true} />);
    expect(screen.getByText("Custom Dev")).toBeInTheDocument();
  });

  it("renders effort badge", () => {
    render(<RequirementTooltip requirement={mockRequirement} visible={true} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows days in stage", () => {
    render(<RequirementTooltip requirement={mockRequirement} visible={true} />);
    expect(screen.getByText("5d in stage")).toBeInTheDocument();
  });

  it("shows AI recommendation when provided", () => {
    render(<RequirementTooltip requirement={mockRequirement} visible={true} />);
    expect(screen.getByText("Consider breaking into subtasks")).toBeInTheDocument();
  });

  it("does not show AI recommendation when not provided", () => {
    const reqWithoutAI = { ...mockRequirement, aiRecommendation: undefined };
    render(<RequirementTooltip requirement={reqWithoutAI} visible={true} />);
    expect(screen.queryByText("Consider breaking into subtasks")).not.toBeInTheDocument();
  });
});
