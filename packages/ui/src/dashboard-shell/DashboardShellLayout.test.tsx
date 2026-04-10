import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardShellLayout } from "./DashboardShellLayout";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: null }),
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: false }),
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/programs",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}));

vi.mock("./SearchProvider", () => ({
  SearchProvider: ({ children }: any) => <div data-testid="search-provider">{children}</div>,
}));

vi.mock("../backend", () => ({
  SandboxBackendProvider: ({ children }: any) => (
    <div data-testid="sandbox-backend-provider">{children}</div>
  ),
}));

vi.mock("../sandbox/SandboxHUDContext", () => ({
  SandboxHUDProvider: ({ children }: any) => (
    <div data-testid="sandbox-hud-provider">{children}</div>
  ),
  useSandboxHUD: () => ({
    isExpanded: false,
    tabs: [],
    isConfigPanelOpen: false,
    closeConfig: vi.fn(),
  }),
}));

vi.mock("../resilience/ResilienceProvider", () => ({
  ResilienceProvider: ({ children }: any) => (
    <div data-testid="resilience-provider">{children}</div>
  ),
}));

vi.mock("../resilience-ui/banners/ReadOnlyModeBanner", () => ({
  ReadOnlyModeBanner: () => null,
}));
vi.mock("../resilience-ui/banners/ServiceDegradedBanner", () => ({
  ServiceDegradedBanner: () => null,
}));
vi.mock("../resilience-ui/banners/StaleDataBanner", () => ({
  StaleDataBanner: () => null,
}));
vi.mock("../resilience-ui/dev-tools/ResilienceDevTools", () => ({
  ResilienceDevTools: () => null,
}));
vi.mock("../resilience-ui/toast/ResilienceToaster", () => ({
  ResilienceToaster: () => null,
}));
vi.mock("../resilience-ui/toast/useResilienceToast", () => ({
  useResilienceToast: () => {},
}));
vi.mock("../billing/TrialBanner", () => ({
  TrialBanner: () => null,
}));

vi.mock("./Header", () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock("./Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock("./useMobileBreakpoint", () => ({
  useMobileBreakpoint: () => false,
}));

vi.mock("../brand", () => ({
  FoundryLogo: () => <div data-testid="foundry-logo" />,
}));

vi.mock("../theme/gsap", () => ({
  gsap: { set: vi.fn(), to: vi.fn(), matchMedia: () => ({ add: vi.fn() }) },
  EASE_SMOOTH: "power2.out",
}));

describe("DashboardShellLayout", () => {
  it("renders children inside provider chain", () => {
    render(
      <DashboardShellLayout>
        <div data-testid="child-content">Hello</div>
      </DashboardShellLayout>,
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("wraps content in SearchProvider", () => {
    render(
      <DashboardShellLayout>
        <span>Content</span>
      </DashboardShellLayout>,
    );
    expect(screen.getByTestId("search-provider")).toBeInTheDocument();
  });

  it("wraps content in SandboxBackendProvider", () => {
    render(
      <DashboardShellLayout>
        <span>Content</span>
      </DashboardShellLayout>,
    );
    expect(screen.getByTestId("sandbox-backend-provider")).toBeInTheDocument();
  });

  it("wraps content in SandboxHUDProvider", () => {
    render(
      <DashboardShellLayout>
        <span>Content</span>
      </DashboardShellLayout>,
    );
    expect(screen.getByTestId("sandbox-hud-provider")).toBeInTheDocument();
  });

  it("wraps content in ResilienceProvider", () => {
    render(
      <DashboardShellLayout>
        <span>Content</span>
      </DashboardShellLayout>,
    );
    expect(screen.getByTestId("resilience-provider")).toBeInTheDocument();
  });
});
