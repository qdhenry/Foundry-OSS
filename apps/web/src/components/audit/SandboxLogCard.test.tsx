import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SandboxLogCard } from "./SandboxLogCard";

let mockLogs: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockLogs,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { sandbox: { logs: { listByTask: "sandbox.logs:listByTask" } } },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

describe("SandboxLogCard", () => {
  it("renders nothing when logs are undefined", () => {
    mockLogs = undefined;
    const { container } = render(<SandboxLogCard taskId={"task-1" as any} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when logs are empty", () => {
    mockLogs = [];
    const { container } = render(<SandboxLogCard taskId={"task-1" as any} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders logs header with count", () => {
    mockLogs = [
      { _id: "log-1", level: "info", message: "Starting execution", timestamp: Date.now() },
    ];
    render(<SandboxLogCard taskId={"task-1" as any} />);
    expect(screen.getByText("Sandbox Logs")).toBeInTheDocument();
    expect(screen.getByText("1 entry")).toBeInTheDocument();
  });

  it("renders plural entries count", () => {
    mockLogs = [
      { _id: "log-1", level: "info", message: "Starting", timestamp: Date.now() },
      { _id: "log-2", level: "error", message: "Failed", timestamp: Date.now() },
    ];
    render(<SandboxLogCard taskId={"task-1" as any} />);
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("renders log messages", () => {
    mockLogs = [
      { _id: "log-1", level: "info", message: "Starting execution", timestamp: Date.now() },
    ];
    render(<SandboxLogCard taskId={"task-1" as any} />);
    expect(screen.getByText("Starting execution")).toBeInTheDocument();
  });
});
