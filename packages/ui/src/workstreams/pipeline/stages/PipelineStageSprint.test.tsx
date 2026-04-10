import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStageSprint } from "./PipelineStageSprint";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../programs", () => ({
  useProgramContext: () => ({ slug: "test-prog" }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn(),
}));

const baseProps = {
  requirement: {
    _id: "req-1",
    orgId: "org-1",
    refId: "REQ-001",
    title: "Test",
    priority: "must_have",
    effortEstimate: "high",
    status: "approved",
  },
  programId: "prog-1",
  workstreamId: "ws-1",
};

describe("PipelineStageSprint", () => {
  it("renders sprint planning heading", () => {
    render(<PipelineStageSprint {...baseProps} tasks={[]} />);
    expect(screen.getByText("Sprint Planning")).toBeInTheDocument();
  });

  it("shows effort estimate", () => {
    render(<PipelineStageSprint {...baseProps} tasks={[]} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows not yet assigned when no sprint", () => {
    render(<PipelineStageSprint {...baseProps} tasks={[]} />);
    expect(screen.getByText("Not yet assigned")).toBeInTheDocument();
  });

  it("shows assigned sprint name from tasks", () => {
    const tasks = [{ _id: "t1", title: "T1", status: "backlog", sprintName: "Sprint 1" }];
    render(<PipelineStageSprint {...baseProps} tasks={tasks} />);
    expect(screen.getByText("Sprint 1")).toBeInTheDocument();
  });

  it("shows new sprint button", () => {
    render(<PipelineStageSprint {...baseProps} tasks={[]} />);
    expect(screen.getByText("+ New Sprint")).toBeInTheDocument();
  });

  it("renders link to sprint planning page", () => {
    render(<PipelineStageSprint {...baseProps} tasks={[]} />);
    expect(screen.getByText("Go to Sprint Planning")).toBeInTheDocument();
  });
});
