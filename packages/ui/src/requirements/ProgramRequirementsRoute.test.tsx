import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseConvexAuth = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => mockUseConvexAuth(),
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/my-prog/requirements",
}));

vi.mock("./RequirementsPage", () => ({
  RequirementsPage: () => <div data-testid="requirements-page" />,
}));

import { ProgramRequirementsRoute } from "./ProgramRequirementsRoute";

describe("ProgramRequirementsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows spinner when auth is loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramRequirementsRoute />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows sign-in message when not authenticated", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramRequirementsRoute />);
    expect(screen.getByText(/Sign in and select a program/)).toBeInTheDocument();
  });

  it("shows spinner when program is loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramRequirementsRoute />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows not found when program is null", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue(null);
    render(<ProgramRequirementsRoute />);
    expect(screen.getByText("Program not found.")).toBeInTheDocument();
  });

  it("renders RequirementsPage when program is loaded", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue({ _id: "prog_1", slug: "my-prog" });
    render(<ProgramRequirementsRoute />);
    expect(screen.getByTestId("requirements-page")).toBeInTheDocument();
  });
});
