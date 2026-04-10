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
  usePathname: () => "/my-prog/patterns",
}));

vi.mock("./PatternsPage", () => ({
  PatternsPage: ({ programId }: any) => (
    <div data-testid="patterns-page" data-program-id={programId} />
  ),
}));

import { ProgramPatternsRoute } from "./ProgramPatternsRoute";

describe("ProgramPatternsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows spinner when auth is loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramPatternsRoute />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows sign-in message when not authenticated", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramPatternsRoute />);
    expect(screen.getByText(/Sign in to load patterns/)).toBeInTheDocument();
  });

  it("shows spinner when program is loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramPatternsRoute />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows not found when program is null", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue(null);
    render(<ProgramPatternsRoute />);
    expect(screen.getByText("Program not found for this route.")).toBeInTheDocument();
  });

  it("renders PatternsPage when program is loaded", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseQuery.mockReturnValue({ _id: "prog_1", slug: "my-prog" });
    render(<ProgramPatternsRoute />);
    expect(screen.getByTestId("patterns-page")).toBeInTheDocument();
  });
});
