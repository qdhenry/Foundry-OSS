import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionHistory } from "./VersionHistory";

const mockVersions = [
  {
    _id: "ver-1",
    version: "v1.0",
    lineCount: 42,
    message: "Initial version",
    _creationTime: Date.now() - 86400000,
  },
  {
    _id: "ver-2",
    version: "v2.0",
    lineCount: 55,
    message: "Added error handling",
    _creationTime: Date.now(),
  },
];

let queryReturn: any = mockVersions;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    skillVersions: { listBySkill: "skillVersions:listBySkill" },
  },
}));

describe("VersionHistory", () => {
  const mockOnViewVersion = vi.fn();
  const mockOnCompare = vi.fn();

  beforeEach(() => {
    mockOnViewVersion.mockReset();
    mockOnCompare.mockReset();
    queryReturn = mockVersions;
  });

  it("renders loading state when versions undefined", () => {
    queryReturn = undefined;
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    expect(screen.getByText("Loading versions...")).toBeInTheDocument();
  });

  it("renders empty state when no versions", () => {
    queryReturn = [];
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    expect(screen.getByText("No version history")).toBeInTheDocument();
  });

  it("renders version numbers", () => {
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    expect(screen.getByText("v2.0")).toBeInTheDocument();
  });

  it("renders version line counts", () => {
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    expect(screen.getByText("42 lines")).toBeInTheDocument();
    expect(screen.getByText("55 lines")).toBeInTheDocument();
  });

  it("renders version messages", () => {
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    expect(screen.getByText("Initial version")).toBeInTheDocument();
    expect(screen.getByText("Added error handling")).toBeInTheDocument();
  });

  it("calls onViewVersion when View button is clicked", () => {
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    const viewButtons = screen.getAllByText("View");
    fireEvent.click(viewButtons[0]);
    expect(mockOnViewVersion).toHaveBeenCalledWith("ver-1");
  });

  it("shows compare bar when 2 versions selected", () => {
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText("2 versions selected")).toBeInTheDocument();
    expect(screen.getByText("Compare")).toBeInTheDocument();
  });

  it("calls onCompare when Compare button is clicked", () => {
    render(
      <VersionHistory
        skillId="skill-1"
        onViewVersion={mockOnViewVersion}
        onCompare={mockOnCompare}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText("Compare"));
    expect(mockOnCompare).toHaveBeenCalledWith("ver-1", "ver-2");
  });
});
