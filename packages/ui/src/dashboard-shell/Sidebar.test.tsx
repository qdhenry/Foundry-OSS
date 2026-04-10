import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_1" } }),
  OrganizationSwitcher: () => <div data-testid="org-switcher" />,
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: () => undefined,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/test-program/overview",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../brand", () => ({
  FoundryLogo: () => <div data-testid="foundry-logo" />,
}));

vi.mock("../theme/gsap", () => ({
  gsap: { set: vi.fn(), to: vi.fn(), matchMedia: () => ({ add: vi.fn() }) },
  EASE_SMOOTH: "power2.out",
}));

vi.mock("./navigation", () => ({
  getNavigation: () => [
    {
      title: "Plan",
      items: [
        { label: "Overview", href: "/test-program", icon: () => <svg />, readiness: "ready" },
      ],
    },
  ],
}));

describe("Sidebar", () => {
  it("renders the foundry logo", () => {
    render(<Sidebar />);
    expect(screen.getAllByTestId("foundry-logo").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the organization switcher", () => {
    render(<Sidebar />);
    expect(screen.getAllByTestId("org-switcher").length).toBeGreaterThanOrEqual(1);
  });

  it("renders navigation items", () => {
    render(<Sidebar />);
    expect(screen.getAllByText("Overview").length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile overlay when mobileOpen is true", () => {
    render(<Sidebar mobileOpen onMobileClose={vi.fn()} />);
    // The mobile overlay adds an extra sidebar render
    expect(screen.getAllByTestId("foundry-logo").length).toBeGreaterThanOrEqual(2);
  });
});
