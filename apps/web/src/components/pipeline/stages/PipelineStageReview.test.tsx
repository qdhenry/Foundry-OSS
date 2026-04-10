import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageReview } from "./PipelineStageReview";

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    requirements: { updateStatus: "requirements:updateStatus" },
  },
}));

vi.mock("../../../../convex/shared/pipelineStage", () => ({
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
  PIPELINE_STAGE_CONFIG: {
    discovery: { label: "Discovery" },
    requirement: { label: "Requirement" },
    sprint_planning: { label: "Sprint Planning" },
    task_generation: { label: "Task Generation" },
    subtask_generation: { label: "Subtask Generation" },
    implementation: { label: "Implementation" },
    testing: { label: "Testing" },
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseRequirement = {
  _id: "req-1",
  refId: "BM-001",
  title: "Customer Account Management",
  priority: "must_have",
  fitGap: "custom_dev",
  effortEstimate: "high",
  status: "approved",
};

const baseProps = {
  requirement: baseRequirement,
  programId: "prog-1" as any,
  workstreamId: "ws-1" as any,
};

describe("PipelineStageReview", () => {
  it("renders Final Review heading", () => {
    render(<PipelineStageReview {...baseProps} tasks={[]} />);
    expect(screen.getByText("Final Review")).toBeInTheDocument();
  });

  it("shows task summary counts", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "done" },
      { _id: "t2", title: "Task 2", status: "done" },
      { _id: "t3", title: "Task 3", status: "in_progress" },
    ];
    render(<PipelineStageReview {...baseProps} tasks={tasks} />);
    expect(screen.getByText("3")).toBeInTheDocument(); // Total
    expect(screen.getByText("2")).toBeInTheDocument(); // Completed
  });

  it("shows approve button when all tasks are done and requirement is not complete", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "done" },
      { _id: "t2", title: "Task 2", status: "done" },
    ];
    render(<PipelineStageReview {...baseProps} tasks={tasks} />);
    const matches = screen.getAllByText(/Approve & Mark Complete/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows completed banner when requirement status is complete", () => {
    render(
      <PipelineStageReview
        {...baseProps}
        requirement={{ ...baseRequirement, status: "complete" }}
        tasks={[{ _id: "t1", title: "Task 1", status: "done" }]}
      />,
    );
    expect(screen.getByText(/completed and approved/)).toBeInTheDocument();
  });

  it("shows remaining tasks message when not all done", () => {
    const tasks = [
      { _id: "t1", title: "Task 1", status: "done" },
      { _id: "t2", title: "Task 2", status: "in_progress" },
    ];
    render(<PipelineStageReview {...baseProps} tasks={tasks} />);
    expect(screen.getByText(/1 task still incomplete/)).toBeInTheDocument();
  });

  it("renders requirement refId", () => {
    render(<PipelineStageReview {...baseProps} tasks={[]} />);
    expect(screen.getByText("BM-001")).toBeInTheDocument();
  });
});
