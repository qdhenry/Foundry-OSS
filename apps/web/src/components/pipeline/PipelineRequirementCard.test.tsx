import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineRequirementCard } from "./PipelineRequirementCard";

vi.mock("../../../convex/shared/pipelineStage", () => ({
  PIPELINE_STAGES: [
    "discovery",
    "requirement",
    "sprint_planning",
    "task_generation",
    "subtask_generation",
    "implementation",
    "testing",
    "review",
  ],
  PIPELINE_STAGE_ORDER: {
    discovery: 0,
    requirement: 1,
    sprint_planning: 2,
    task_generation: 3,
    subtask_generation: 4,
    implementation: 5,
    testing: 6,
    review: 7,
  },
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery", shortLabel: "Disc" },
    requirement: { label: "Requirement", shortLabel: "Req" },
    sprint_planning: { label: "Sprint Planning", shortLabel: "Sprint" },
    task_generation: { label: "Task Generation", shortLabel: "Tasks" },
    subtask_generation: { label: "Subtask Generation", shortLabel: "Sub" },
    implementation: { label: "Implementation", shortLabel: "Impl" },
    testing: { label: "Testing", shortLabel: "Test" },
    review: { label: "Review", shortLabel: "Rev" },
  },
}));

const baseRequirement = {
  _id: "req-1",
  refId: "REQ-001",
  title: "User Authentication",
  priority: "must_have",
  fitGap: "custom_dev",
  pipelineStage: "implementation",
  sprintName: "Sprint 1",
  taskCount: 4,
  tasksCompleted: 2,
};

describe("PipelineRequirementCard", () => {
  it("renders refId and title", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);
    expect(screen.getByText("REQ-001")).toBeInTheDocument();
    expect(screen.getByText("User Authentication")).toBeInTheDocument();
  });

  it("renders priority badge", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
  });

  it("renders fit/gap badge", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);
    expect(screen.getByText("Custom Dev")).toBeInTheDocument();
  });

  it("renders sprint name", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("renders task completion count", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);
    expect(screen.getByText("2/4 tasks")).toBeInTheDocument();
  });

  it("renders pipeline stage label and number", () => {
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={vi.fn()} />);
    expect(screen.getByText("Implementation")).toBeInTheDocument();
    expect(screen.getByText("Stage 6 of 8")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows Needs Approval badge at requirement stage", () => {
    render(
      <PipelineRequirementCard
        requirement={{ ...baseRequirement, pipelineStage: "requirement" }}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Needs Approval")).toBeInTheDocument();
  });

  it("shows Generate Tasks badge at task_generation stage with 0 tasks", () => {
    render(
      <PipelineRequirementCard
        requirement={{
          ...baseRequirement,
          pipelineStage: "task_generation",
          taskCount: 0,
          tasksCompleted: 0,
        }}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("Generate Tasks")).toBeInTheDocument();
  });

  it("handles keyboard activation with Enter", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<PipelineRequirementCard requirement={baseRequirement} onClick={onClick} />);
    const button = screen.getByRole("button");
    button.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalled();
  });
});
