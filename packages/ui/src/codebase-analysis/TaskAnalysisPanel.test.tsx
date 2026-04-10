import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskAnalysisPanel } from "./TaskAnalysisPanel";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
}));

vi.mock("./DirectoryPicker", () => ({
  DirectoryPicker: () => <div data-testid="dir-picker">DirPicker</div>,
}));

vi.mock("./SubtaskProposalList", () => ({
  SubtaskProposalList: () => <div data-testid="proposals">Proposals</div>,
}));

const baseTask = {
  _id: "task-1",
  title: "Build auth",
  programId: "prog-1",
};

describe("TaskAnalysisPanel", () => {
  it("shows no repos warning when task has no repos", () => {
    render(<TaskAnalysisPanel taskId="task-1" task={baseTask} />);
    expect(screen.getByText("No repositories linked to this task")).toBeInTheDocument();
  });

  it("renders analysis UI when repos linked", () => {
    render(<TaskAnalysisPanel taskId="task-1" task={{ ...baseTask, repositoryIds: ["repo-1"] }} />);
    expect(screen.getByText("Analyze Task Against Codebase")).toBeInTheDocument();
    expect(screen.getByTestId("dir-picker")).toBeInTheDocument();
  });

  it("shows analyze button with subtask count", () => {
    render(<TaskAnalysisPanel taskId="task-1" task={{ ...baseTask, repositoryIds: ["repo-1"] }} />);
    expect(screen.getByText("Analyze 0 Subtasks")).toBeInTheDocument();
  });
});
