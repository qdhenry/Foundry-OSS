import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskAuditTrail } from "./TaskAuditTrail";

let queryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

vi.mock("./SandboxLogSummary", () => ({
  SandboxLogSummary: () => <div data-testid="sandbox-log-summary" />,
}));

function makeRecord(overrides = {}) {
  return {
    _id: "rec-1",
    eventType: "sandbox_started",
    taskId: "task-1",
    timestamp: Date.now() - 60_000 * 5,
    initiatedByName: "Alice",
    outcome: {},
    metadata: {},
    ...overrides,
  };
}

describe("TaskAuditTrail", () => {
  it("shows loading when records undefined", () => {
    queryReturn = undefined;
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Loading audit records...")).toBeInTheDocument();
  });

  it("shows empty state when no records", () => {
    queryReturn = [];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("No audit events recorded yet.")).toBeInTheDocument();
  });

  it("renders event count badge", () => {
    queryReturn = [makeRecord(), makeRecord({ _id: "rec-2", eventType: "sandbox_completed" })];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("2 events")).toBeInTheDocument();
  });

  it("renders singular event label", () => {
    queryReturn = [makeRecord()];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("1 event")).toBeInTheDocument();
  });

  it("renders event type label", () => {
    queryReturn = [makeRecord()];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Sandbox Started")).toBeInTheDocument();
  });

  it("renders description for sandbox_started", () => {
    queryReturn = [makeRecord()];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Sandbox execution started")).toBeInTheDocument();
  });

  it("renders description with branch", () => {
    queryReturn = [makeRecord({ environment: { worktreeBranch: "feature/auth" } })];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Sandbox launched on branch feature/auth")).toBeInTheDocument();
  });

  it("renders initiator name", () => {
    queryReturn = [makeRecord()];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders metadata pills", () => {
    queryReturn = [
      makeRecord({
        outcome: { filesChanged: 5, durationMs: 45000 },
        skillName: "Build API",
      }),
    ];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText(/5 changed/)).toBeInTheDocument();
    expect(screen.getByText(/45s/)).toBeInTheDocument();
    expect(screen.getByText(/Build API/)).toBeInTheDocument();
  });

  it("collapses when header clicked", () => {
    queryReturn = [makeRecord()];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText("Sandbox Started")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Audit Trail"));
    expect(screen.queryByText("Sandbox Started")).not.toBeInTheDocument();
  });

  it("starts collapsed when defaultCollapsed is true", () => {
    queryReturn = [makeRecord()];
    render(<TaskAuditTrail taskId="task-1" defaultCollapsed />);
    expect(screen.queryByText("Sandbox Started")).not.toBeInTheDocument();
  });

  it("renders sandbox_completed description with PR", () => {
    queryReturn = [
      makeRecord({
        eventType: "sandbox_completed",
        outcome: { prNumber: 42 },
      }),
    ];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText(/PR #42 created/)).toBeInTheDocument();
  });

  it("renders sandbox_failed description", () => {
    queryReturn = [
      makeRecord({
        eventType: "sandbox_failed",
        outcome: { error: "OOM killed" },
      }),
    ];
    render(<TaskAuditTrail taskId="task-1" />);
    expect(screen.getByText(/OOM killed/)).toBeInTheDocument();
  });
});
