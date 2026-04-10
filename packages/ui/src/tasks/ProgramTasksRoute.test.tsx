import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseConvexAuth = vi.fn();
const mockUseQuery = vi.fn();
const mockUseOrganization = vi.fn();
const mockUsePathname = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => mockUseConvexAuth(),
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => mockUseOrganization(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("./TasksPage", () => ({
  TasksPage: ({ programId, programSlug }: any) => (
    <div data-testid="tasks-page" data-program-id={programId} data-slug={programSlug} />
  ),
}));

import { ProgramTasksRoute } from "./ProgramTasksRoute";

describe("ProgramTasksRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePathname.mockReturnValue("/acme/tasks");
    mockUseOrganization.mockReturnValue({ organization: { id: "org_1" } });
  });

  it("shows spinner during auth loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramTasksRoute />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows sign-in message when not authenticated", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramTasksRoute />);
    expect(screen.getByText("Sign in to load tasks.")).toBeInTheDocument();
  });

  it("shows org prompt when no organization selected", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseOrganization.mockReturnValue({ organization: null });
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramTasksRoute />);
    expect(screen.getByText("Select an organization to load tasks.")).toBeInTheDocument();
  });

  it("shows program prompt when slug is a known root", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUsePathname.mockReturnValue("/programs/something");
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramTasksRoute />);
    expect(screen.getByText("Select a program to load tasks.")).toBeInTheDocument();
  });

  it("shows spinner while program is loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramTasksRoute />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows not found when program is null", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue(null);
    render(<ProgramTasksRoute />);
    expect(screen.getByText("Program not found for this route.")).toBeInTheDocument();
  });

  it("renders TasksPage when program is resolved", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue({ _id: "prog_1", slug: "acme" });
    render(<ProgramTasksRoute />);
    const tp = screen.getByTestId("tasks-page");
    expect(tp).toHaveAttribute("data-program-id", "prog_1");
    expect(tp).toHaveAttribute("data-slug", "acme");
  });
});
