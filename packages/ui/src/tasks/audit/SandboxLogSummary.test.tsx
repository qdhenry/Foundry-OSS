import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SandboxLogSummary } from "./SandboxLogSummary";

let queryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

describe("SandboxLogSummary", () => {
  it("returns null when summary is undefined", () => {
    queryReturn = undefined;
    const { container } = render(<SandboxLogSummary taskId="task-1" />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalCount is 0", () => {
    queryReturn = { totalCount: 0, levelCounts: {}, recentLogs: [] };
    const { container } = render(<SandboxLogSummary taskId="task-1" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders toggle button with label", () => {
    queryReturn = {
      totalCount: 5,
      levelCounts: { info: 3, error: 2 },
      recentLogs: [],
    };
    render(<SandboxLogSummary taskId="task-1" />);
    expect(screen.getByText("Sandbox Logs")).toBeInTheDocument();
  });

  it("renders level count badges", () => {
    queryReturn = {
      totalCount: 5,
      levelCounts: { info: 3, error: 2 },
      recentLogs: [],
    };
    render(<SandboxLogSummary taskId="task-1" />);
    expect(screen.getByText("3 info")).toBeInTheDocument();
    expect(screen.getByText("2 error")).toBeInTheDocument();
  });

  it("expands to show recent logs", () => {
    queryReturn = {
      totalCount: 1,
      levelCounts: { stdout: 1 },
      recentLogs: [{ level: "info", message: "Server started", timestamp: Date.now() }],
    };
    render(<SandboxLogSummary taskId="task-1" />);
    fireEvent.click(screen.getByText("Sandbox Logs"));
    expect(screen.getByText("Server started")).toBeInTheDocument();
  });

  it("renders log level label", () => {
    queryReturn = {
      totalCount: 1,
      levelCounts: { error: 1 },
      recentLogs: [{ level: "error", message: "Connection failed", timestamp: Date.now() }],
    };
    render(<SandboxLogSummary taskId="task-1" />);
    fireEvent.click(screen.getByText("Sandbox Logs"));
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
