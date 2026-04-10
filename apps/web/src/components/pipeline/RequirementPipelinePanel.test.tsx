import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RequirementPipelinePanel } from "./RequirementPipelinePanel";

const mockQueryResults: Record<string, any> = {};

vi.mock("convex/react", () => ({
  useQuery: (fn: string) => mockQueryResults[fn],
}));

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({ slug: "test-program" }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    requirements: { get: "requirements:get" },
    tasks: { listByProgram: "tasks:listByProgram" },
    discoveryFindings: { listByProgram: "discoveryFindings:listByProgram" },
  },
}));

vi.mock("../../../convex/shared/pipelineStage", () => ({
  derivePipelineStage: () => "implementation",
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
}));

vi.mock("./PipelineActivityLog", () => ({
  PipelineActivityLog: () => <div>Activity Log Mock</div>,
}));

vi.mock("./PipelineStageContent", () => ({
  PipelineStageContent: ({ stage }: any) => <div>Stage Content: {stage}</div>,
}));

vi.mock("./PipelineStepper", () => ({
  PipelineStepper: () => <div>Stepper Mock</div>,
}));

describe("RequirementPipelinePanel", () => {
  const onClose = vi.fn();

  it("shows loading spinner when requirement is undefined", () => {
    mockQueryResults["requirements:get"] = undefined;
    mockQueryResults["tasks:listByProgram"] = [];
    mockQueryResults["discoveryFindings:listByProgram"] = [];
    const { container } = render(
      <RequirementPipelinePanel
        requirementId={"req-1" as any}
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onClose={onClose}
      />,
    );
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("returns null when requirement is null", () => {
    mockQueryResults["requirements:get"] = null;
    mockQueryResults["tasks:listByProgram"] = [];
    mockQueryResults["discoveryFindings:listByProgram"] = [];
    const { container } = render(
      <RequirementPipelinePanel
        requirementId={"req-1" as any}
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onClose={onClose}
      />,
    );
    expect(container.querySelector(".fixed")).toBeNull();
  });

  it("renders requirement title and refId", () => {
    mockQueryResults["requirements:get"] = {
      _id: "req-1",
      refId: "REQ-001",
      title: "User Authentication",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "active",
    };
    mockQueryResults["tasks:listByProgram"] = [];
    mockQueryResults["discoveryFindings:listByProgram"] = [];
    render(
      <RequirementPipelinePanel
        requirementId={"req-1" as any}
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/REQ-001/)).toBeInTheDocument();
    expect(screen.getByText(/User Authentication/)).toBeInTheDocument();
  });

  it("renders priority and fitGap badges", () => {
    mockQueryResults["requirements:get"] = {
      _id: "req-1",
      refId: "REQ-001",
      title: "Test",
      priority: "must_have",
      fitGap: "custom_dev",
      status: "active",
    };
    mockQueryResults["tasks:listByProgram"] = [];
    mockQueryResults["discoveryFindings:listByProgram"] = [];
    render(
      <RequirementPipelinePanel
        requirementId={"req-1" as any}
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Custom Dev")).toBeInTheDocument();
  });

  it("renders Back to Pipeline button", () => {
    mockQueryResults["requirements:get"] = {
      _id: "req-1",
      refId: "REQ-001",
      title: "Test",
      priority: "must_have",
      fitGap: "native",
      status: "active",
    };
    mockQueryResults["tasks:listByProgram"] = [];
    mockQueryResults["discoveryFindings:listByProgram"] = [];
    render(
      <RequirementPipelinePanel
        requirementId={"req-1" as any}
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Back to Pipeline")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const closeFn = vi.fn();
    mockQueryResults["requirements:get"] = {
      _id: "req-1",
      refId: "REQ-001",
      title: "Test",
      priority: "must_have",
      fitGap: "native",
      status: "active",
    };
    mockQueryResults["tasks:listByProgram"] = [];
    mockQueryResults["discoveryFindings:listByProgram"] = [];
    const user = userEvent.setup();
    render(
      <RequirementPipelinePanel
        requirementId={"req-1" as any}
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onClose={closeFn}
      />,
    );
    // Close button (X icon in header)
    const buttons = screen.getAllByRole("button");
    const closeBtn = buttons.find((b) => b.querySelector("svg path[d='M6 18L18 6M6 6l12 12']"));
    if (closeBtn) await user.click(closeBtn);
    expect(closeFn).toHaveBeenCalled();
  });

  it("renders Back to Discovery Hub when referrer is discovery", () => {
    mockQueryResults["requirements:get"] = {
      _id: "req-1",
      refId: "REQ-001",
      title: "Test",
      priority: "must_have",
      fitGap: "native",
      status: "active",
    };
    mockQueryResults["tasks:listByProgram"] = [];
    mockQueryResults["discoveryFindings:listByProgram"] = [];
    render(
      <RequirementPipelinePanel
        requirementId={"req-1" as any}
        programId={"prog-1" as any}
        workstreamId={"ws-1" as any}
        onClose={onClose}
        referrer="discovery"
      />,
    );
    expect(screen.getByText("Back to Discovery Hub")).toBeInTheDocument();
  });
});
