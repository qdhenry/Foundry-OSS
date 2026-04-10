import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageRequirement } from "./PipelineStageRequirement";

const mockUpdateStatus = vi.fn();
const mockUpdateRequirement = vi.fn();
const mockRequestDecomposition = vi.fn();
const mockCreateTask = vi.fn();
const mockUpdateTask = vi.fn();
const mockCreateSprint = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: (fn: string) => {
    if (fn === "requirements:updateStatus") return mockUpdateStatus;
    if (fn === "requirements:update") return mockUpdateRequirement;
    if (fn === "taskDecomposition:requestDecomposition") return mockRequestDecomposition;
    if (fn === "tasks:create") return mockCreateTask;
    if (fn === "tasks:update") return mockUpdateTask;
    if (fn === "sprints:create") return mockCreateSprint;
    return vi.fn();
  },
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    sprints: { listByProgram: "sprints:listByProgram", create: "sprints:create" },
    tasks: { update: "tasks:update", create: "tasks:create" },
    requirements: { update: "requirements:update", updateStatus: "requirements:updateStatus" },
    taskDecomposition: { requestDecomposition: "taskDecomposition:requestDecomposition" },
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
  orgId: "org-1",
  refId: "BM-001",
  title: "Customer Account Management",
  description: "Self-service portal for B2B buyers",
  priority: "must_have",
  fitGap: "custom_dev",
  effortEstimate: "high",
  status: "draft",
};

const baseProps = {
  requirement: baseRequirement,
  programId: "prog-1" as any,
  workstreamId: "ws-1" as any,
  tasks: [] as any[],
};

describe("PipelineStageRequirement", () => {
  it("renders requirement details", () => {
    render(<PipelineStageRequirement {...baseProps} />);
    expect(screen.getByText("Requirement Details")).toBeInTheDocument();
    expect(screen.getByText("Customer Account Management")).toBeInTheDocument();
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Custom Dev")).toBeInTheDocument();
  });

  it("shows draft banner with approve button when status is draft", () => {
    render(<PipelineStageRequirement {...baseProps} />);
    expect(screen.getByText("This requirement is in draft")).toBeInTheDocument();
    expect(screen.getByText("Approve Requirement")).toBeInTheDocument();
  });

  it("shows generate tasks banner when approved with no tasks", () => {
    render(
      <PipelineStageRequirement
        {...baseProps}
        requirement={{ ...baseRequirement, status: "approved" }}
      />,
    );
    expect(screen.getByText("Requirement approved")).toBeInTheDocument();
    expect(screen.getByText("Generate Tasks")).toBeInTheDocument();
  });

  it("renders edit button in requirement details section", () => {
    render(<PipelineStageRequirement {...baseProps} />);
    // The "Edit" button is rendered in the requirement details header
    const editLinks = screen.getAllByText("Edit");
    expect(editLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders next steps for draft requirement without effort", () => {
    render(
      <PipelineStageRequirement
        {...baseProps}
        requirement={{ ...baseRequirement, effortEstimate: undefined }}
      />,
    );
    expect(screen.getByText("Set effort estimate")).toBeInTheDocument();
    expect(screen.getByText("Approve the requirement")).toBeInTheDocument();
  });
});
