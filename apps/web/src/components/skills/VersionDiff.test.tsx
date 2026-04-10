import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionDiff } from "./VersionDiff";

const mockComparison = {
  versionA: { content: "line one\nline two\nline three", version: "v1.0" },
  versionB: { content: "line one\nline modified\nline three\nline four", version: "v2.0" },
};

let queryReturn: any = mockComparison;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    skillVersions: { compare: "skillVersions:compare" },
  },
}));

describe("VersionDiff", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockReset();
    queryReturn = mockComparison;
  });

  it("renders loading state when comparison is undefined", () => {
    queryReturn = undefined;
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={mockOnClose} />);
    expect(screen.getByText("Loading comparison...")).toBeInTheDocument();
  });

  it("renders version labels", () => {
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={mockOnClose} />);
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    expect(screen.getByText("v2.0")).toBeInTheDocument();
  });

  it("renders Version Diff heading", () => {
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={mockOnClose} />);
    expect(screen.getByText("Version Diff")).toBeInTheDocument();
  });

  it("shows added and removed line counts", () => {
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={mockOnClose} />);
    // Should show +2 (line modified + line four) and -1 (line two)
    const addedEl = screen.getByText(/\+\d/);
    const removedEl = screen.getByText(/-\d/);
    expect(addedEl).toBeInTheDocument();
    expect(removedEl).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={mockOnClose} />);
    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("renders diff line content", () => {
    render(<VersionDiff versionAId="v1" versionBId="v2" onClose={mockOnClose} />);
    expect(screen.getByText("line one")).toBeInTheDocument();
    expect(screen.getByText("line three")).toBeInTheDocument();
  });
});
