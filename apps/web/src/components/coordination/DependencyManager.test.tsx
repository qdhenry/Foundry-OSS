import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DependencyManager } from "./DependencyManager";

const mockCreateDep = vi.fn();
const mockUpdateDep = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => [
    { _id: "ws-1", name: "Auth Module", shortCode: "AUTH" },
    { _id: "ws-2", name: "Payment System", shortCode: "PAY" },
  ]),
  useMutation: vi.fn((fn: string) => {
    if (fn === "workstreamDependencies:create") return mockCreateDep;
    if (fn === "workstreamDependencies:update") return mockUpdateDep;
    return vi.fn();
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    workstreams: { listByProgram: "workstreams:listByProgram" },
    workstreamDependencies: {
      create: "workstreamDependencies:create",
      update: "workstreamDependencies:update",
    },
  },
}));

describe("DependencyManager", () => {
  const defaultProps = {
    programId: "prog-1" as any,
    orgId: "org-1",
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders New Dependency heading for create mode", () => {
    render(<DependencyManager {...defaultProps} />);
    expect(screen.getByText("New Dependency")).toBeInTheDocument();
  });

  it("renders Edit Dependency heading when dependency prop is passed", () => {
    render(
      <DependencyManager
        {...defaultProps}
        dependency={{
          _id: "dep-1" as any,
          sourceWorkstreamId: "ws-1" as any,
          targetWorkstreamId: "ws-2" as any,
          description: "Depends on auth",
          status: "active",
        }}
      />,
    );
    expect(screen.getByText("Edit Dependency")).toBeInTheDocument();
  });

  it("renders workstream options in dropdowns", () => {
    render(<DependencyManager {...defaultProps} />);
    expect(screen.getAllByText("AUTH - Auth Module").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PAY - Payment System").length).toBeGreaterThan(0);
  });

  it("renders status dropdown with all options", () => {
    render(<DependencyManager {...defaultProps} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<DependencyManager {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows error when source and target not selected on submit", async () => {
    render(<DependencyManager {...defaultProps} />);
    fireEvent.submit(screen.getByText("Create").closest("form")!);
    expect(
      screen.getByText("Please select both source and target workstreams."),
    ).toBeInTheDocument();
  });

  it("renders loading state when workstreams are undefined", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    const { container } = render(<DependencyManager {...defaultProps} />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
