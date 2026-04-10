import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionHistory } from "./VersionHistory";

let queryReturn: any;

vi.mock("convex/react", () => ({
  useQuery: () => queryReturn,
}));

const mockVersions = [
  {
    _id: "ver-1",
    version: "v1.0",
    lineCount: 50,
    message: "Initial version",
    _creationTime: Date.now() - 86400000,
  },
  {
    _id: "ver-2",
    version: "v2.0",
    lineCount: 75,
    message: "Added error handling",
    _creationTime: Date.now(),
  },
];

describe("VersionHistory", () => {
  it("shows loading when versions undefined", () => {
    queryReturn = undefined;
    render(<VersionHistory skillId="skill-1" onViewVersion={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByText("Loading versions...")).toBeInTheDocument();
  });

  it("shows empty state when no versions", () => {
    queryReturn = [];
    render(<VersionHistory skillId="skill-1" onViewVersion={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByText("No version history")).toBeInTheDocument();
  });

  it("renders version numbers", () => {
    queryReturn = mockVersions;
    render(<VersionHistory skillId="skill-1" onViewVersion={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByText("v1.0")).toBeInTheDocument();
    expect(screen.getByText("v2.0")).toBeInTheDocument();
  });

  it("renders line counts", () => {
    queryReturn = mockVersions;
    render(<VersionHistory skillId="skill-1" onViewVersion={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByText("50 lines")).toBeInTheDocument();
    expect(screen.getByText("75 lines")).toBeInTheDocument();
  });

  it("renders version messages", () => {
    queryReturn = mockVersions;
    render(<VersionHistory skillId="skill-1" onViewVersion={vi.fn()} onCompare={vi.fn()} />);
    expect(screen.getByText("Initial version")).toBeInTheDocument();
    expect(screen.getByText("Added error handling")).toBeInTheDocument();
  });

  it("calls onViewVersion when View button clicked", () => {
    queryReturn = mockVersions;
    const onViewVersion = vi.fn();
    render(<VersionHistory skillId="skill-1" onViewVersion={onViewVersion} onCompare={vi.fn()} />);
    fireEvent.click(screen.getAllByText("View")[0]);
    expect(onViewVersion).toHaveBeenCalledWith("ver-1");
  });

  it("shows compare button when two versions selected", () => {
    queryReturn = mockVersions;
    render(<VersionHistory skillId="skill-1" onViewVersion={vi.fn()} onCompare={vi.fn()} />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    expect(screen.getByText("Compare")).toBeInTheDocument();
    expect(screen.getByText("2 versions selected")).toBeInTheDocument();
  });

  it("calls onCompare with selected versions", () => {
    queryReturn = mockVersions;
    const onCompare = vi.fn();
    render(<VersionHistory skillId="skill-1" onViewVersion={vi.fn()} onCompare={onCompare} />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText("Compare"));
    expect(onCompare).toHaveBeenCalledWith("ver-1", "ver-2");
  });
});
