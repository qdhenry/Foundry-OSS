import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TraceGroup } from "./TraceGroup";
import type { RequirementGroup } from "./utils";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("./TraceRow", () => ({
  TraceRow: ({ execution }: any) => (
    <div data-testid={`trace-row-${execution._id}`}>{execution.taskType}</div>
  ),
}));

function makeGroup(overrides: Partial<RequirementGroup> = {}): RequirementGroup {
  return {
    requirementId: "req-1",
    requirementRefId: "REQ-001",
    requirementTitle: "Auth Flow",
    workstreamName: "Auth Module",
    executions: [
      {
        _id: "exec-1",
        _creationTime: Date.now(),
        programId: "prog-1",
        taskType: "code_review",
        trigger: "manual",
        reviewStatus: "accepted",
      },
    ],
    successCount: 1,
    totalCount: 1,
    lastExecutionTime: Date.now(),
    ...overrides,
  };
}

describe("TraceGroup", () => {
  it("renders requirement ref ID and title", () => {
    render(<TraceGroup group={makeGroup()} />);
    expect(screen.getByText("REQ-001:")).toBeInTheDocument();
    expect(screen.getByText("Auth Flow")).toBeInTheDocument();
  });

  it("renders workstream name", () => {
    render(<TraceGroup group={makeGroup()} />);
    expect(screen.getByText(/Auth Module/)).toBeInTheDocument();
  });

  it("renders execution count", () => {
    render(<TraceGroup group={makeGroup()} />);
    expect(screen.getByText(/1 execution/)).toBeInTheDocument();
  });

  it("renders all-accepted status badge", () => {
    render(<TraceGroup group={makeGroup({ successCount: 2, totalCount: 2 })} />);
    expect(screen.getByText("2/2 OK")).toBeInTheDocument();
  });

  it("renders failed status badge when has rejections", () => {
    const group = makeGroup({
      successCount: 1,
      totalCount: 2,
      executions: [
        {
          _id: "exec-1",
          _creationTime: Date.now(),
          programId: "prog-1",
          taskType: "code_review",
          trigger: "manual",
          reviewStatus: "accepted",
        },
        {
          _id: "exec-2",
          _creationTime: Date.now(),
          programId: "prog-1",
          taskType: "code_review",
          trigger: "manual",
          reviewStatus: "rejected",
        },
      ],
    });
    render(<TraceGroup group={group} />);
    expect(screen.getByText("1/2 OK")).toBeInTheDocument();
  });

  it("renders pending status badge when not all reviewed", () => {
    const group = makeGroup({
      successCount: 0,
      totalCount: 1,
      executions: [
        {
          _id: "exec-1",
          _creationTime: Date.now(),
          programId: "prog-1",
          taskType: "code_review",
          trigger: "manual",
          reviewStatus: "pending",
        },
      ],
    });
    render(<TraceGroup group={group} />);
    expect(screen.getByText("0/1 reviewed")).toBeInTheDocument();
  });

  it("renders nested trace rows", () => {
    render(<TraceGroup group={makeGroup()} />);
    expect(screen.getByTestId("trace-row-exec-1")).toBeInTheDocument();
  });
});
