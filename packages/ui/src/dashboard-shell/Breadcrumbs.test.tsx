import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
const mockPathname = vi.fn(() => "/prog-1/tasks");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock untitledui icons
vi.mock("@untitledui/icons", () => ({
  ChevronRight: (props: any) => <span data-testid="chevron" {...props} />,
  Home01: (props: any) => <span data-testid="home-icon" {...props} />,
}));

// Mock convex/react for dynamic segment resolution
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

import { Breadcrumbs } from "./Breadcrumbs";

describe("Breadcrumbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue(undefined);
  });

  it("capitalizes 'sprints' to 'Sprints'", () => {
    mockPathname.mockReturnValue("/prog-1/sprints");
    render(<Breadcrumbs />);
    expect(screen.getByText("Sprints")).toBeInTheDocument();
  });

  it("capitalizes 'tasks' to 'Tasks'", () => {
    mockPathname.mockReturnValue("/prog-1/tasks");
    render(<Breadcrumbs />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("renders 'mission-control' as 'Mission Control'", () => {
    mockPathname.mockReturnValue("/prog-1/mission-control");
    render(<Breadcrumbs />);
    expect(screen.getByText("Mission Control")).toBeInTheDocument();
  });

  it("renders the last segment as non-link text", () => {
    mockPathname.mockReturnValue("/prog-1/tasks");
    render(<Breadcrumbs />);
    const lastSegment = screen.getByText("Tasks");
    expect(lastSegment.tagName).toBe("SPAN");
    expect(lastSegment.closest("a")).toBeNull();
  });

  it("renders intermediate segments as clickable links", () => {
    mockPathname.mockReturnValue("/prog-1/tasks");
    render(<Breadcrumbs />);
    // "prog-1" is an intermediate segment (not in segmentNames, so raw)
    const link = screen.getByText("prog-1");
    expect(link.closest("a")).toHaveAttribute("href", "/prog-1");
  });

  it("renders Dashboard text when pathname is root", () => {
    mockPathname.mockReturnValue("/");
    render(<Breadcrumbs />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders home link pointing to root", () => {
    mockPathname.mockReturnValue("/prog-1/tasks");
    render(<Breadcrumbs />);
    const homeLink = screen.getByTestId("home-icon").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  describe("dynamic segment resolution", () => {
    it("resolves sprint ID to sprint name in breadcrumb", () => {
      mockPathname.mockReturnValue("/prog-1/sprints/sprint-abc123");
      mockUseQuery.mockImplementation((queryName: string) => {
        if (queryName === "sprints:get") return { name: "Sprint Alpha", number: 1 };
        return undefined;
      });
      render(<Breadcrumbs />);
      expect(screen.getByText("Sprint Alpha")).toBeInTheDocument();
    });

    it("shows loading placeholder while resolving dynamic segment", () => {
      mockPathname.mockReturnValue("/prog-1/sprints/sprint-abc123");
      mockUseQuery.mockReturnValue(undefined);
      render(<Breadcrumbs />);
      expect(screen.getByText("...")).toBeInTheDocument();
    });

    it("falls back to raw segment when record is null", () => {
      mockPathname.mockReturnValue("/prog-1/sprints/sprint-abc123");
      mockUseQuery.mockReturnValue(null);
      render(<Breadcrumbs />);
      expect(screen.getByText("sprint-abc123")).toBeInTheDocument();
    });

    it("does not resolve known segment names as dynamic IDs", () => {
      mockPathname.mockReturnValue("/prog-1/sprints");
      render(<Breadcrumbs />);
      // "sprints" is a known segment, not a dynamic child of anything
      expect(screen.getByText("Sprints")).toBeInTheDocument();
      expect(mockUseQuery).not.toHaveBeenCalledWith("sprints:get", expect.anything());
    });

    it("resolves skill ID to skill name", () => {
      mockPathname.mockReturnValue("/prog-1/skills/skill-xyz");
      mockUseQuery.mockImplementation((queryName: string) => {
        if (queryName === "skills:get") return { name: "React Development" };
        return undefined;
      });
      render(<Breadcrumbs />);
      expect(screen.getByText("React Development")).toBeInTheDocument();
    });
  });
});
