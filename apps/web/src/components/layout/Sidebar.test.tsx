import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { Sidebar } from "./Sidebar";

let mockPathname = "/programs";
let mockSearchParams = new URLSearchParams();
let mockResolvedProgram: any = null;
let mockNavState: any;

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
  useQuery: (queryName: unknown, args: unknown) => {
    if (args === "skip") return undefined;
    const name = String(queryName);
    if (name.includes("getBySlug")) return mockResolvedProgram;
    if (name.includes("getNavigationState")) return mockNavState;
    return undefined;
  },
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
    HelpCircle: Icon,
    Home01: Icon,
    LayersThree01: Icon,
    Link01: Icon,
    List: Icon,
    LogOut01: Icon,
    Moon01: Icon,
    Palette: Icon,
    SearchMd: Icon,
    Server01: Icon,
    Settings01: Icon,
    Shield01: Icon,
    Sun: Icon,
    Tool01: Icon,
    User01: Icon,
  };
});

describe("Sidebar", () => {
  beforeEach(() => {
    mockPathname = "/programs";
    mockSearchParams = new URLSearchParams();
    mockResolvedProgram = null;
    mockNavState = undefined;
  });

  it("renders the Foundry brand", () => {
    render(<Sidebar />);
    expect(screen.getByText("FOUNDRY")).toBeInTheDocument();
  });

  it("renders section headings", () => {
    render(<Sidebar />);
    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("Knowledge")).toBeInTheDocument();
  });

  it("renders Programs link", () => {
    render(<Sidebar />);
    expect(screen.getByText("Programs")).toBeInTheDocument();
  });

  it("shows disabled links when no program is selected", () => {
    render(<Sidebar />);
    // Plan section items should be disabled (href="#" → rendered as spans)
    const discoveryItems = screen.getAllByText("Discovery");
    expect(discoveryItems.length).toBeGreaterThanOrEqual(1);
    // Check that Discovery is rendered as a span (disabled), not a link
    const disabledDiscovery = discoveryItems.find((el) => !el.closest("a"));
    expect(disabledDiscovery).toBeTruthy();
  });

  it("shows program-scoped links when programId is in path", () => {
    mockPathname = "/prog-123/discovery";
    render(<Sidebar />);
    const discoveryLinks = screen.getAllByText("Discovery");
    const linkEl = discoveryLinks.find((el) => el.closest("a"));
    expect(linkEl).toBeTruthy();
  });

  it("displays pending findings badge when nav state has pending count", () => {
    mockPathname = "/prog-123/discovery";
    mockResolvedProgram = { _id: "prog-123" };
    mockNavState = {
      discoveryPending: 5,
      requirementsTotal: 0,
      requirementsUnassigned: 0,
      workstreamsCount: 0,
      sprintsActive: 0,
      sprintsPlanning: 0,
      tasksTotal: 0,
      tasksInProgress: 0,
      skillsCount: 0,
      risksCount: 0,
      gatesCount: 0,
      designAssetsTotal: 0,
    };
    render(<Sidebar />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders Organization Switcher", () => {
    render(<Sidebar />);
    expect(screen.getByText("Organization Switcher")).toBeInTheDocument();
  });
});
