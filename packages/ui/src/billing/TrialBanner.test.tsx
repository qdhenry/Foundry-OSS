import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrialBanner } from "./TrialBanner";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  usePathname: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: mocks.useQuery,
}));

vi.mock("next/navigation", () => ({
  usePathname: mocks.usePathname,
}));

describe("TrialBanner", () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.usePathname.mockReset();
    mocks.usePathname.mockReturnValue("/boston-beer-merchtank/tasks");
  });

  it("returns null when isConverted=true (no banner rendered)", () => {
    mocks.useQuery.mockReturnValue({
      isOnTrial: true,
      sessionsRemaining: 5,
      programsRemaining: 1,
      isExhausted: false,
      isConverted: true,
      sessionsUsed: 5,
      sessionsLimit: 10,
    });

    const { container } = render(<TrialBanner orgId="org_test" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when isOnTrial=false", () => {
    mocks.useQuery.mockReturnValue({
      isOnTrial: false,
      sessionsRemaining: 0,
      programsRemaining: 0,
      isExhausted: false,
      isConverted: false,
      sessionsUsed: 0,
      sessionsLimit: 0,
    });

    const { container } = render(<TrialBanner orgId="org_test" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null when useQuery returns undefined (loading)", () => {
    mocks.useQuery.mockReturnValue(undefined);

    const { container } = render(<TrialBanner orgId="org_test" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders blue banner with "10 of 10 Smelt sessions remaining" when active trial with 10 remaining', () => {
    mocks.useQuery.mockReturnValue({
      isOnTrial: true,
      sessionsRemaining: 10,
      programsRemaining: 1,
      isExhausted: false,
      isConverted: false,
      sessionsUsed: 0,
      sessionsLimit: 10,
    });

    render(<TrialBanner orgId="org_test" />);

    expect(screen.getByText("10 of 10")).toBeInTheDocument();
    expect(screen.getByText(/Smelt sessions remaining/)).toBeInTheDocument();

    // Check the blue/info banner styling
    const banner = screen.getByText(/Smelt sessions remaining/).closest("div[class*='info']");
    expect(banner).toBeTruthy();
  });

  it('renders amber banner with "Only 2 sessions left" when sessionsRemaining=2', () => {
    mocks.useQuery.mockReturnValue({
      isOnTrial: true,
      sessionsRemaining: 2,
      programsRemaining: 1,
      isExhausted: false,
      isConverted: false,
      sessionsUsed: 8,
      sessionsLimit: 10,
    });

    render(<TrialBanner orgId="org_test" />);

    expect(screen.getByText(/Only 2/)).toBeInTheDocument();
    expect(screen.getByText(/sessions left/)).toBeInTheDocument();

    // Check the warning banner styling
    const banner = screen.getByText(/Only 2/).closest("div[class*='warning']");
    expect(banner).toBeTruthy();
  });

  it('renders "Your free trial is complete" when isExhausted=true', () => {
    mocks.useQuery.mockReturnValue({
      isOnTrial: true,
      sessionsRemaining: 0,
      programsRemaining: 0,
      isExhausted: true,
      isConverted: false,
      sessionsUsed: 10,
      sessionsLimit: 10,
    });

    render(<TrialBanner orgId="org_test" />);

    expect(screen.getByText(/Your free trial is complete/)).toBeInTheDocument();
  });

  it("dismiss button hides exhausted banner", async () => {
    const user = userEvent.setup();

    mocks.useQuery.mockReturnValue({
      isOnTrial: true,
      sessionsRemaining: 0,
      programsRemaining: 0,
      isExhausted: true,
      isConverted: false,
      sessionsUsed: 10,
      sessionsLimit: 10,
    });

    render(<TrialBanner orgId="org_test" />);

    // Banner should be visible
    expect(screen.getByText(/Your free trial is complete/)).toBeInTheDocument();

    // Click dismiss
    await user.click(screen.getByRole("button", { name: /Dismiss banner/i }));

    // Banner should be gone
    expect(screen.queryByText(/Your free trial is complete/)).not.toBeInTheDocument();
  });

  it('upgrade link href includes program slug "/boston-beer-merchtank/settings?tab=billing"', () => {
    mocks.useQuery.mockReturnValue({
      isOnTrial: true,
      sessionsRemaining: 10,
      programsRemaining: 1,
      isExhausted: false,
      isConverted: false,
      sessionsUsed: 0,
      sessionsLimit: 10,
    });

    render(<TrialBanner orgId="org_test" />);

    const upgradeLink = screen.getByRole("link", { name: /Upgrade/i });
    expect(upgradeLink).toHaveAttribute("href", "/boston-beer-merchtank/settings?tab=billing");
  });
});
