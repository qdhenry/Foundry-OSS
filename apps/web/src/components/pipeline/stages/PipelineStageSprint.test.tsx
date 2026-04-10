import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageSprint } from "./PipelineStageSprint";

vi.mock("@/lib/programContext", () => ({
  useProgramContext: () => ({
    program: { _id: "prog-1", name: "Test" },
    programId: "prog-1",
    slug: "test-program",
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    sprints: { listByProgram: "sprints:listByProgram", create: "sprints:create" },
    tasks: { update: "tasks:update", create: "tasks:create" },
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const baseProps = {
  requirement: {
    _id: "req-1",
    orgId: "org-1",
    refId: "BM-001",
    title: "Customer Account Management",
    priority: "must_have",
    effortEstimate: "high",
    status: "approved",
  },
  programId: "prog-1" as any,
  workstreamId: "ws-1" as any,
  tasks: [] as any[],
};

describe("PipelineStageSprint", () => {
  it("renders Sprint Planning heading", () => {
    render(<PipelineStageSprint {...baseProps} />);
    expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
  });

  it("shows not assigned when no sprint", () => {
    render(<PipelineStageSprint {...baseProps} />);
    expect(screen.getByText("Not yet assigned")).toBeInTheDocument();
  });

  it("shows effort estimate label", () => {
    render(<PipelineStageSprint {...baseProps} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows not estimated when no effort", () => {
    render(
      <PipelineStageSprint
        {...baseProps}
        requirement={{ ...baseProps.requirement, effortEstimate: undefined }}
      />,
    );
    expect(screen.getByText("Not estimated")).toBeInTheDocument();
  });

  it("shows assigned sprint name when tasks have sprint", () => {
    const tasks = [{ _id: "t1", title: "Task 1", status: "todo", sprintName: "Sprint 1" }];
    render(<PipelineStageSprint {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("renders link to sprint planning page", () => {
    render(<PipelineStageSprint {...baseProps} />);
    expect(screen.getByText("Go to Sprint Planning")).toBeInTheDocument();
  });

  it("shows + New Sprint button", () => {
    render(<PipelineStageSprint {...baseProps} />);
    expect(screen.getByText("+ New Sprint")).toBeInTheDocument();
  });

  it("renders next steps when no sprint and no tasks", () => {
    render(<PipelineStageSprint {...baseProps} />);
    expect(screen.getByText("Assign to a sprint")).toBeInTheDocument();
    expect(screen.getByText("Run AI task decomposition")).toBeInTheDocument();
  });
});
