import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseConvexAuth = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn().mockResolvedValue(undefined));
const mockUseOrganization = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: () => mockUseConvexAuth(),
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => mockUseMutation(),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => mockUseOrganization(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../theme/useAnimations", () => ({
  useStaggerEntrance: vi.fn(),
  useFadeIn: vi.fn(),
}));

import { ProgramsPage } from "./ProgramsPage";

describe("ProgramsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows spinner while auth is loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    mockUseOrganization.mockReturnValue({ organization: null });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramsPage />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows sign-in message when not authenticated", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
    mockUseOrganization.mockReturnValue({ organization: null });
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramsPage />);
    expect(screen.getByText("Sign in to load your programs.")).toBeInTheDocument();
  });

  it("shows organization prompt when no org selected", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseOrganization.mockReturnValue({ organization: null });
    mockUseQuery.mockReturnValue(undefined);
    render(<ProgramsPage />);
    expect(screen.getByText("Select an organization to load your programs.")).toBeInTheDocument();
  });

  it("shows spinner when programs are loading", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseOrganization.mockReturnValue({ organization: { id: "org_1" } });
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<ProgramsPage />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no programs exist", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseOrganization.mockReturnValue({ organization: { id: "org_1" } });
    mockUseQuery.mockReturnValue([]);
    render(<ProgramsPage />);
    expect(screen.getByText("No programs yet")).toBeInTheDocument();
    const createLinks = screen.getAllByText("Create Program");
    expect(createLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders program cards when data is available", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseOrganization.mockReturnValue({ organization: { id: "org_1" } });
    mockUseQuery.mockReturnValue([
      {
        _id: "p1",
        slug: "acme",
        name: "AcmeCorp",
        clientName: "Acme",
        targetPlatform: "salesforce_b2b",
        phase: "build",
        status: "active",
      },
    ]);
    render(<ProgramsPage />);
    expect(screen.getByText("AcmeCorp")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("Salesforce B2B")).toBeInTheDocument();
  });

  it("links setup-in-progress programs to resume URL", () => {
    mockUseConvexAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mockUseOrganization.mockReturnValue({ organization: { id: "org_1" } });
    mockUseQuery.mockReturnValue([
      {
        _id: "p2",
        name: "In Progress",
        clientName: "Client",
        targetPlatform: "none",
        phase: "discovery",
        status: "active",
        setupStatus: "pending",
      },
    ]);
    render(<ProgramsPage />);
    const link = screen.getByText("In Progress").closest("a");
    expect(link).toHaveAttribute("href", "/programs/new?resume=p2");
  });
});
