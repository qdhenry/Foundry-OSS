import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskAuditTrail } from "./TaskAuditTrail";

let mockRecords: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockRecords,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { executionAudit: { listByTask: "executionAudit:listByTask" } },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

vi.mock("./SandboxLogSummary", () => ({
  SandboxLogSummary: () => <div data-testid="sandbox-log-summary" />,
}));

describe("TaskAuditTrail", () => {
  it("renders loading state when records are undefined", () => {
    mockRecords = undefined;
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Audit Trail")).toBeInTheDocument();
    expect(screen.getByText("Loading audit records...")).toBeInTheDocument();
  });

  it("renders empty state when no records", () => {
    mockRecords = [];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("No audit events recorded yet.")).toBeInTheDocument();
  });

  it("renders events with labels and descriptions", () => {
    mockRecords = [
      {
        _id: "rec-1",
        eventType: "sandbox_started",
        taskId: "task-1",
        timestamp: Date.now() - 60_000,
        initiatedByName: "Alice",
        environment: {},
      },
    ];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Sandbox Started")).toBeInTheDocument();
    expect(screen.getByText("Sandbox execution started")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows event count badge", () => {
    mockRecords = [
      {
        _id: "rec-1",
        eventType: "sandbox_completed",
        taskId: "task-1",
        timestamp: Date.now(),
        initiatedByName: "Bob",
        outcome: {},
      },
    ];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("1 event")).toBeInTheDocument();
  });

  it("collapses when defaultCollapsed is true", () => {
    mockRecords = [
      {
        _id: "rec-1",
        eventType: "sandbox_started",
        taskId: "task-1",
        timestamp: Date.now(),
        initiatedByName: "Alice",
      },
    ];
    render(<TaskAuditTrail taskId="task-1" defaultCollapsed />);
    // The events should not be visible when collapsed
    expect(screen.queryByText("Sandbox Started")).not.toBeInTheDocument();
  });

  it("toggles collapse on header click", () => {
    mockRecords = [
      {
        _id: "rec-1",
        eventType: "sandbox_started",
        taskId: "task-1",
        timestamp: Date.now(),
        initiatedByName: "Alice",
      },
    ];
    render(<TaskAuditTrail taskId="task-1" defaultCollapsed />);
    fireEvent.click(screen.getByText("Audit Trail"));
    expect(screen.getByText("Sandbox Started")).toBeInTheDocument();
  });
});
