import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineRequirementCard } from "./PipelineRequirementCard";

const baseRequirement = {
  _id: "req-1",
  refId: "REQ-001",
  title: "Test Requirement Title",
  priority: "must_have",
  fitGap: "custom_dev",
  pipelineStage: "requirement",
  taskCount: 0,
  tasksCompleted: 0,
};

describe("PipelineRequirementCard", () => {
  it("renders refId, title, and badges inline", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);

    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("Test Requirement Title")).toBeInTheDocument();
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Custom Dev")).toBeInTheDocument();
  });

  it("renders stage badge", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);

    expect(screen.getByText("Requirement")).toBeInTheDocument();
  });

  it("shows 'Needs Approval' badge when stage is requirement", () => {
    render(
      <PipelineRequirementCard
        requirement={{ ...baseRequirement, pipelineStage: "requirement" }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Needs Approval")).toBeInTheDocument();
  });

  it("shows 'Generate Tasks' badge when stage is task_generation with no tasks", () => {
    render(
      <PipelineRequirementCard
        requirement={{
          ...baseRequirement,
          pipelineStage: "task_generation",
          taskCount: 0,
        }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Generate Tasks")).toBeInTheDocument();
  });

  it("does not show action badges for other stages", () => {
    render(
      <PipelineRequirementCard
        requirement={{ ...baseRequirement, pipelineStage: "implementation" }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.queryByText("Needs Approval")).not.toBeInTheDocument();
    expect(screen.queryByText("Generate Tasks")).not.toBeInTheDocument();
  });

  it("truncates long titles", () => {
    const longTitle =
      "This is an extremely long requirement title that should be truncated by the CSS truncate class to prevent it from overflowing the card layout";

    render(
      <PipelineRequirementCard
        requirement={{ ...baseRequirement, title: longTitle }}
        onClick={vi.fn()}
      />,
    );

    const titleElement = screen.getByText(longTitle);
    expect(titleElement).toHaveClass("truncate");
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();

    render(<PipelineRequirementCard requirement={baseRequirement} onClick={handleClick} />);

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("shows task count when tasks exist", () => {
    render(
      <PipelineRequirementCard
        requirement={{
          ...baseRequirement,
          taskCount: 3,
          tasksCompleted: 1,
        }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("applies highlight ring when isHighlighted is true", () => {
    Element.prototype.scrollIntoView = vi.fn();

    render(
      <PipelineRequirementCard
        requirement={baseRequirement}
        onClick={vi.fn()}
        isHighlighted={true}
      />,
    );

    const card = screen.getByRole("button");
    expect(card).toHaveClass("ring-2");
  });
});
