import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type FileChangeSummary, SandboxFileChanges } from "./SandboxFileChanges";

const mockSummary: FileChangeSummary = {
  files: [
    { status: "A", path: "src/new-file.ts" },
    { status: "M", path: "src/modified.ts" },
    { status: "D", path: "src/deleted.ts" },
  ],
  diffs: {
    "src/modified.ts": "+added line\n-removed line\n@@ -1,3 +1,4 @@\n context",
  },
  totalFiles: 3,
};

describe("SandboxFileChanges", () => {
  it("renders file count in header", () => {
    render(<SandboxFileChanges fileChangeSummary={mockSummary} />);
    expect(screen.getByText(/3 files/)).toBeInTheDocument();
  });

  it("renders file paths", () => {
    render(<SandboxFileChanges fileChangeSummary={mockSummary} />);
    expect(screen.getByText("src/new-file.ts")).toBeInTheDocument();
    expect(screen.getByText("src/modified.ts")).toBeInTheDocument();
    expect(screen.getByText("src/deleted.ts")).toBeInTheDocument();
  });

  it("renders status badges A, M, D", () => {
    render(<SandboxFileChanges fileChangeSummary={mockSummary} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
  });

  it("collapses file list on header click", () => {
    render(<SandboxFileChanges fileChangeSummary={mockSummary} />);
    fireEvent.click(screen.getByText(/Files Changed/));
    expect(screen.queryByText("src/new-file.ts")).not.toBeInTheDocument();
  });

  it("expands diff when clicking a file with diff", () => {
    render(<SandboxFileChanges fileChangeSummary={mockSummary} mode="complete" />);
    fireEvent.click(screen.getByText("src/modified.ts"));
    expect(screen.getByText("+added line")).toBeInTheDocument();
    expect(screen.getByText("-removed line")).toBeInTheDocument();
  });

  it("shows live mode header text", () => {
    render(<SandboxFileChanges fileChangeSummary={mockSummary} mode="live" />);
    expect(screen.getByText(/Files Touched/)).toBeInTheDocument();
  });

  it("handles single file count text", () => {
    const single: FileChangeSummary = {
      files: [{ status: "A", path: "src/file.ts" }],
      diffs: {},
      totalFiles: 1,
    };
    render(<SandboxFileChanges fileChangeSummary={single} />);
    expect(screen.getByText(/1 file\b/)).toBeInTheDocument();
  });
});
