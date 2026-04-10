import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkstreamDependencies } from "./WorkstreamDependencies";

const mockRemoveDep = vi.fn();
const mockUpdateStatus = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn((fn: string) => {
    if (fn === "workstreamDependencies:remove") return mockRemoveDep;
    if (fn === "workstreamDependencies:updateStatus") return mockUpdateStatus;
    return vi.fn();
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    workstreamDependencies: {
      listByProgram: "workstreamDependencies:listByProgram",
      remove: "workstreamDependencies:remove",
      updateStatus: "workstreamDependencies:updateStatus",
    },
  },
}));

vi.mock("./DependencyManager", () => ({
  DependencyManager: ({ onClose }: any) => (
    <div data-testid="dependency-manager">
      <button type="button" onClick={onClose}>
        MockClose
      </button>
    </div>
  ),
}));

describe("WorkstreamDependencies", () => {
  const defaultProps = {
    programId: "prog-1" as any,
    orgId: "org-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading", () => {
    render(<WorkstreamDependencies {...defaultProps} />);
    expect(screen.getByText("Workstream Dependencies")).toBeInTheDocument();
  });

  it("renders empty state when no dependencies", () => {
    render(<WorkstreamDependencies {...defaultProps} />);
    expect(
      screen.getByText(
        "No dependencies defined yet. Add one to track cross-workstream relationships.",
      ),
    ).toBeInTheDocument();
  });

  it("renders loading state when dependencies are undefined", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const { container } = render(<WorkstreamDependencies {...defaultProps} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(3);
  });

  it("renders Add Dependency button", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([]);

    render(<WorkstreamDependencies {...defaultProps} />);
    expect(screen.getByText("Add Dependency")).toBeInTheDocument();
  });

  it("shows form when Add Dependency is clicked", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([]);

    render(<WorkstreamDependencies {...defaultProps} />);
    fireEvent.click(screen.getByText("Add Dependency"));
    expect(screen.getByTestId("dependency-manager")).toBeInTheDocument();
  });

  it("renders dependency list with status badge", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "dep-1",
        status: "active",
        description: "Auth depends on billing",
        sourceWorkstream: { shortCode: "AUTH", name: "Auth Module" },
        targetWorkstream: { shortCode: "BILL", name: "Billing" },
      },
    ]);

    render(<WorkstreamDependencies {...defaultProps} />);
    expect(screen.getByText("AUTH")).toBeInTheDocument();
    expect(screen.getByText("BILL")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Auth depends on billing")).toBeInTheDocument();
  });
});
