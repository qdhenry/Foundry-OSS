import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SandboxLogSummary } from "./SandboxLogSummary";

let mockSummary: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockSummary,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { sandbox: { logs: { summaryByTask: "sandbox.logs:summaryByTask" } } },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

describe("SandboxLogSummary", () => {
  it("renders nothing when summary is undefined", () => {
    mockSummary = undefined;
    const { container } = render(<SandboxLogSummary taskId={"task-1" as any} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when totalCount is 0", () => {
    mockSummary = { totalCount: 0, levelCounts: {}, recentLogs: [] };
    const { container } = render(<SandboxLogSummary taskId={"task-1" as any} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders collapsed summary with level counts", () => {
    mockSummary = {
      totalCount: 5,
      levelCounts: { info: 3, error: 2 },
      recentLogs: [],
    };
    render(<SandboxLogSummary taskId={"task-1" as any} />);
    expect(screen.getByText("Sandbox Logs")).toBeInTheDocument();
    expect(screen.getByText("3 info")).toBeInTheDocument();
    expect(screen.getByText("2 error")).toBeInTheDocument();
  });

  it("expands to show recent logs on click", () => {
    mockSummary = {
      totalCount: 1,
      levelCounts: { info: 1 },
      recentLogs: [{ level: "info", message: "Hello world", timestamp: Date.now() }],
    };
    render(<SandboxLogSummary taskId={"task-1" as any} />);
    fireEvent.click(screen.getByText("Sandbox Logs"));
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });
});
