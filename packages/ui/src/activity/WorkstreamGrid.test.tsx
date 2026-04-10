import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EnrichedExecution } from "./utils";
import { WorkstreamGrid } from "./WorkstreamGrid";

function makeExecution(overrides: Partial<EnrichedExecution> = {}): EnrichedExecution {
  return {
    _id: "exec-1",
    _creationTime: Date.now(),
    programId: "prog-1",
    taskType: "code_review",
    trigger: "manual",
    reviewStatus: "pending",
    ...overrides,
  };
}

describe("WorkstreamGrid", () => {
  it("returns null when no workstreams", () => {
    const { container } = render(<WorkstreamGrid executions={[]} onDrillDown={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders workstream entries grouped by ID", () => {
    const executions = [
      makeExecution({ _id: "1", workstreamId: "ws-1", workstreamName: "Auth" }),
      makeExecution({ _id: "2", workstreamId: "ws-1", workstreamName: "Auth" }),
      makeExecution({ _id: "3", workstreamId: "ws-2", workstreamName: "Billing" }),
    ];
    render(<WorkstreamGrid executions={executions} onDrillDown={vi.fn()} />);

    expect(screen.getByText("Auth")).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("2 runs")).toBeInTheDocument();
    expect(screen.getByText("1 run")).toBeInTheDocument();
  });

  it("sorts workstreams by execution count descending", () => {
    const executions = [
      makeExecution({ _id: "1", workstreamId: "ws-1", workstreamName: "Auth" }),
      makeExecution({ _id: "2", workstreamId: "ws-2", workstreamName: "Billing" }),
      makeExecution({ _id: "3", workstreamId: "ws-2", workstreamName: "Billing" }),
      makeExecution({ _id: "4", workstreamId: "ws-2", workstreamName: "Billing" }),
    ];
    render(<WorkstreamGrid executions={executions} onDrillDown={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Billing");
  });

  it("calls onDrillDown with correct args", () => {
    const onDrillDown = vi.fn();
    const executions = [makeExecution({ _id: "1", workstreamId: "ws-1", workstreamName: "Auth" })];
    render(<WorkstreamGrid executions={executions} onDrillDown={onDrillDown} />);
    fireEvent.click(screen.getByText("Auth"));
    expect(onDrillDown).toHaveBeenCalledWith("ws-1", "Auth");
  });

  it("skips executions without workstream info", () => {
    const executions = [
      makeExecution({ _id: "1" }),
      makeExecution({ _id: "2", workstreamId: "ws-1", workstreamName: "Auth" }),
    ];
    render(<WorkstreamGrid executions={executions} onDrillDown={vi.fn()} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
  });
});
