import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityTrace } from "./ActivityTrace";

vi.mock("./TraceGroup", () => ({
  TraceGroup: ({ group }: any) => (
    <div data-testid="trace-group">{group.requirementId ?? "unlinked"}</div>
  ),
}));

vi.mock("./utils", async () => {
  const actual = await vi.importActual("./utils");
  return {
    ...actual,
    groupByRequirement: (execs: any[]) => {
      if (execs.length === 0) return [];
      return [{ requirementId: "req_1", requirementTitle: "Test Req", executions: execs }];
    },
  };
});

const context = {
  filter: "status" as const,
  label: "Status: completed",
  filterFn: () => true,
};

describe("ActivityTrace", () => {
  it("renders back button", () => {
    render(<ActivityTrace executions={[]} context={context} onBack={vi.fn()} />);
    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });

  it("renders context label", () => {
    render(<ActivityTrace executions={[]} context={context} onBack={vi.fn()} />);
    expect(screen.getByText(/Status: completed/)).toBeInTheDocument();
  });

  it("shows empty state when no matching executions", () => {
    const emptyContext = { ...context, filterFn: () => false };
    render(<ActivityTrace executions={[]} context={emptyContext} onBack={vi.fn()} />);
    expect(screen.getByText("No agent activity matching this filter")).toBeInTheDocument();
  });

  it("calls onBack when back button clicked", () => {
    const onBack = vi.fn();
    render(<ActivityTrace executions={[]} context={context} onBack={onBack} />);
    fireEvent.click(screen.getByText("Back to Dashboard"));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders trace groups for matching executions", () => {
    const executions = [{ _id: "exec_1", status: "completed" }] as any;
    render(<ActivityTrace executions={executions} context={context} onBack={vi.fn()} />);
    expect(screen.getByTestId("trace-group")).toBeInTheDocument();
  });
});
