import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { FileChangeSummary } from "./SandboxFileChanges";
import { SandboxFileChanges } from "./SandboxFileChanges";

const sampleSummary: FileChangeSummary = {
  files: [
    { status: "A", path: "src/new-file.ts" },
    { status: "M", path: "src/existing.ts" },
    { status: "D", path: "src/removed.ts" },
  ],
  diffs: {
    "src/new-file.ts": "+export const hello = 'world';",
    "src/existing.ts": "-old line\n+new line",
  },
  totalFiles: 3,
};

describe("SandboxFileChanges", () => {
  it("renders file list with correct status badges", () => {
    render(<SandboxFileChanges fileChangeSummary={sampleSummary} />);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByText("src/new-file.ts")).toBeInTheDocument();
    expect(screen.getByText("src/existing.ts")).toBeInTheDocument();
    expect(screen.getByText("src/removed.ts")).toBeInTheDocument();
  });

  it('shows "Files Touched" label in live mode', () => {
    render(<SandboxFileChanges fileChangeSummary={sampleSummary} mode="live" />);

    expect(screen.getByText("Files Touched")).toBeInTheDocument();
  });

  it('shows "Files Changed" label in complete mode', () => {
    render(<SandboxFileChanges fileChangeSummary={sampleSummary} mode="complete" />);

    expect(screen.getByText("Files Changed")).toBeInTheDocument();
  });

  it("shows file count in header", () => {
    render(<SandboxFileChanges fileChangeSummary={sampleSummary} />);

    expect(screen.getByText("(3 files)")).toBeInTheDocument();
  });

  it("expands to show diff when file with diff is clicked in complete mode", async () => {
    const user = userEvent.setup();
    render(<SandboxFileChanges fileChangeSummary={sampleSummary} mode="complete" />);

    // Diff not visible initially
    expect(screen.queryByText("+export const hello = 'world';")).not.toBeInTheDocument();

    // Click the file with a diff
    await user.click(screen.getByText("src/new-file.ts"));

    // Diff should now be visible
    expect(screen.getByText("+export const hello = 'world';")).toBeInTheDocument();
  });

  it("does not expand files in live mode", async () => {
    const user = userEvent.setup();
    render(<SandboxFileChanges fileChangeSummary={sampleSummary} mode="live" />);

    await user.click(screen.getByText("src/new-file.ts"));

    // Diff should NOT appear in live mode
    expect(screen.queryByText("+export const hello = 'world';")).not.toBeInTheDocument();
  });

  it("collapses file list when header is clicked", async () => {
    const user = userEvent.setup();
    render(<SandboxFileChanges fileChangeSummary={sampleSummary} />);

    expect(screen.getByText("src/new-file.ts")).toBeInTheDocument();

    // Click the header to collapse
    await user.click(screen.getByText("Files Changed"));

    expect(screen.queryByText("src/new-file.ts")).not.toBeInTheDocument();
  });

  it("handles single file with no diff", () => {
    const minimal: FileChangeSummary = {
      files: [{ status: "M", path: "src/only-file.ts" }],
      diffs: {},
      totalFiles: 1,
    };

    render(<SandboxFileChanges fileChangeSummary={minimal} />);

    expect(screen.getByText("src/only-file.ts")).toBeInTheDocument();
    expect(screen.getByText("(1 file)")).toBeInTheDocument();
  });
});
