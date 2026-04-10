import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ── GSAP mocks (barrel export triggers gsap loading) ──────────────
vi.mock("gsap", () => {
  const gsapMock = {
    set: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    matchMedia: vi.fn(() => ({ add: vi.fn() })),
    registerPlugin: vi.fn(),
  };
  return { default: gsapMock };
});
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: {} }));
vi.mock("gsap/Flip", () => ({ Flip: { getState: vi.fn(), from: vi.fn() } }));
vi.mock("@gsap/react", () => ({ useGSAP: vi.fn() }));

import { Breadcrumbs } from "./Breadcrumbs";

let mockPathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: () => undefined,
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_test" } }),
  OrganizationSwitcher: () => <div>Organization Switcher</div>,
}));

// Explicit icon mock — Proxy-based mocks hang vitest's module resolution
vi.mock("@untitledui/icons", () => {
  const Icon = (props: Record<string, unknown>) => <span data-testid="icon" {...props} />;
  return {
    __esModule: true,
    Activity: Icon,
    AlertTriangle: Icon,
    BarChart01: Icon,
    BookOpen01: Icon,
    BracketsCheck: Icon,
    Calendar: Icon,
    CheckSquare: Icon,
    ChevronRight: Icon,
    Clock: Icon,
    ClockRewind: Icon,
    ClipboardCheck: Icon,
    Compass01: Icon,
    File06: Icon,
    FileAttachment01: Icon,
    FileCheck02: Icon,
    Grid01: Icon,
    Home01: Icon,
    LayersThree01: Icon,
    Link01: Icon,
    List: Icon,
    LogOut01: Icon,
    Moon01: Icon,
    SearchMd: Icon,
    Server01: Icon,
    Settings01: Icon,
    Shield01: Icon,
    Sun: Icon,
    Tool01: Icon,
    User01: Icon,
  };
});

describe("Breadcrumbs", () => {
  it("renders Dashboard label at root path", () => {
    mockPathname = "/";
    render(<Breadcrumbs />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
  });

  it("renders known segment names for mapped paths", () => {
    mockPathname = "/prog-1/discovery";
    render(<Breadcrumbs />);
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("prog-1")).toBeInTheDocument();
  });

  it("renders raw segment when no label mapping exists", () => {
    mockPathname = "/prog-1/some-custom-page";
    render(<Breadcrumbs />);
    expect(screen.getByText("some-custom-page")).toBeInTheDocument();
  });

  it("last segment is not a link", () => {
    mockPathname = "/prog-1/skills";
    render(<Breadcrumbs />);
    const skillsEl = screen.getByText("Skills");
    expect(skillsEl.tagName).toBe("SPAN");
    expect(skillsEl.closest("a")).toBeNull();
  });

  it("intermediate segments are links", () => {
    mockPathname = "/prog-1/skills";
    render(<Breadcrumbs />);
    const prog1Link = screen.getByText("prog-1");
    expect(prog1Link.closest("a")).toHaveAttribute("href", "/prog-1");
  });

  it("renders mission-control as Mission Control", () => {
    mockPathname = "/prog-1/mission-control";
    render(<Breadcrumbs />);
    expect(screen.getByText("Mission Control")).toBeInTheDocument();
  });

  it("renders sprints as Sprints", () => {
    mockPathname = "/prog-1/sprints";
    render(<Breadcrumbs />);
    expect(screen.getByText("Sprints")).toBeInTheDocument();
  });

  it("renders tasks as Tasks", () => {
    mockPathname = "/prog-1/tasks";
    render(<Breadcrumbs />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("renders integrations as Integrations", () => {
    mockPathname = "/prog-1/integrations";
    render(<Breadcrumbs />);
    expect(screen.getByText("Integrations")).toBeInTheDocument();
  });

  it("renders settings as Settings", () => {
    mockPathname = "/prog-1/settings";
    render(<Breadcrumbs />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders audit as Audit Log", () => {
    mockPathname = "/prog-1/audit";
    render(<Breadcrumbs />);
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });
});
