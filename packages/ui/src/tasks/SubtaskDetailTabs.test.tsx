import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Check: () => <span data-testid="icon-check" />,
  Copy: () => <span data-testid="icon-copy" />,
  FileText: () => <span data-testid="icon-file-text" />,
  FolderOpen: () => <span data-testid="icon-folder" />,
  GitCommit: () => <span data-testid="icon-git" />,
  Terminal: () => <span data-testid="icon-terminal" />,
}));

import { SubtaskDetailTabs } from "./SubtaskDetailTabs";

const baseSubtask = {
  _id: "st1",
  title: "Subtask 1",
  description: "Test description",
  prompt: "Write code here",
  estimatedFiles: 3,
  complexityScore: 4,
  estimatedDurationMs: 180000,
  order: 0,
  isPausePoint: false,
  status: "pending",
};

describe("SubtaskDetailTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders sizing metadata", () => {
    render(<SubtaskDetailTabs subtask={baseSubtask} />);
    expect(screen.getByText("Est. Files: 3")).toBeInTheDocument();
    expect(screen.getByText("Complexity: 4/5")).toBeInTheDocument();
    expect(screen.getByText("Est. Time: ~3 min")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<SubtaskDetailTabs subtask={baseSubtask} />);
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("shows prompt tab by default", () => {
    render(<SubtaskDetailTabs subtask={baseSubtask} />);
    expect(screen.getByText("Write code here")).toBeInTheDocument();
  });

  it("shows allowed files in files tab", () => {
    render(
      <SubtaskDetailTabs
        subtask={{ ...baseSubtask, allowedFiles: ["src/main.ts", "src/utils.ts"] }}
      />,
    );
    fireEvent.click(screen.getByText("Files"));
    expect(screen.getByText("src/main.ts")).toBeInTheDocument();
    expect(screen.getByText("src/utils.ts")).toBeInTheDocument();
  });

  it("shows changed files with scope violation markers", () => {
    render(
      <SubtaskDetailTabs
        subtask={{
          ...baseSubtask,
          status: "completed",
          filesChanged: ["src/main.ts", "src/secret.ts"],
          scopeViolations: ["src/secret.ts"],
        }}
      />,
    );
    fireEvent.click(screen.getByText("Files"));
    expect(screen.getByText("src/secret.ts")).toBeInTheDocument();
    expect(screen.getByTestId("icon-alert")).toBeInTheDocument();
  });

  it("disables diff tab when no commitSha", () => {
    render(<SubtaskDetailTabs subtask={baseSubtask} />);
    const diffButton = screen.getByText("Diff").closest("button");
    expect(diffButton).toBeDisabled();
  });

  it("shows commit sha in diff tab", () => {
    render(<SubtaskDetailTabs subtask={{ ...baseSubtask, commitSha: "abc12345def67890" }} />);
    fireEvent.click(screen.getByText("Diff"));
    expect(screen.getByText("abc12345")).toBeInTheDocument();
  });

  it("disables logs tab for pending subtasks", () => {
    render(<SubtaskDetailTabs subtask={baseSubtask} />);
    const logsButton = screen.getByText("Logs").closest("button");
    expect(logsButton).toBeDisabled();
  });

  it("shows log viewer for non-pending subtasks", () => {
    mockUseQuery.mockReturnValue([]);
    render(<SubtaskDetailTabs subtask={{ ...baseSubtask, status: "completed" }} />);
    fireEvent.click(screen.getByText("Logs"));
    expect(screen.getByText("No logs yet.")).toBeInTheDocument();
  });

  it("shows actual duration when available", () => {
    render(<SubtaskDetailTabs subtask={{ ...baseSubtask, executionDurationMs: 45000 }} />);
    expect(screen.getByText("Actual: 45s")).toBeInTheDocument();
  });

  it("handles copy prompt button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<SubtaskDetailTabs subtask={baseSubtask} />);
    const copyBtn = screen.getByTitle("Copy prompt");
    fireEvent.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith("Write code here");
  });
});
