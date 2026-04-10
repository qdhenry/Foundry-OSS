import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChangedFilesSection } from "./ChangedFilesSection";

const mockActionFn = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockActionFn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sourceControl: {
      tasks: {
        prActionsInternal: {
          listPRFiles: "sourceControl.tasks.prActionsInternal:listPRFiles",
        },
      },
    },
  },
}));

describe("ChangedFilesSection", () => {
  it("renders header with file count and stats", () => {
    render(
      <ChangedFilesSection prId={"pr-1" as any} filesChanged={5} additions={120} deletions={30} />,
    );
    expect(screen.getByText("Changed Files")).toBeInTheDocument();
    expect(screen.getByText(/5 files/)).toBeInTheDocument();
    expect(screen.getByText("+120")).toBeInTheDocument();
    expect(screen.getByText("-30")).toBeInTheDocument();
  });

  it("starts collapsed", () => {
    render(
      <ChangedFilesSection prId={"pr-1" as any} filesChanged={3} additions={50} deletions={10} />,
    );
    expect(screen.queryByText("Loading files...")).not.toBeInTheDocument();
  });

  it("loads files on expand", async () => {
    mockActionFn.mockResolvedValue([
      { filename: "src/index.ts", status: "modified", additions: 10, deletions: 2, patch: null },
      { filename: "src/new.ts", status: "added", additions: 40, deletions: 0, patch: null },
    ]);
    const user = userEvent.setup();
    render(
      <ChangedFilesSection prId={"pr-1" as any} filesChanged={2} additions={50} deletions={2} />,
    );

    await user.click(screen.getByText("Changed Files"));
    expect(mockActionFn).toHaveBeenCalled();
    expect(await screen.findByText("src/index.ts")).toBeInTheDocument();
    expect(screen.getByText("src/new.ts")).toBeInTheDocument();
  });

  it("shows singular file text", () => {
    render(
      <ChangedFilesSection prId={"pr-1" as any} filesChanged={1} additions={5} deletions={1} />,
    );
    expect(screen.getByText(/1 file(?!s)/)).toBeInTheDocument();
  });
});
