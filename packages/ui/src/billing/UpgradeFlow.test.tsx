import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpgradeFlow } from "./UpgradeFlow";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("./useProgramSlug", () => ({
  useProgramSettingsPath: vi.fn(() => "/test-program/settings"),
}));

describe("UpgradeFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state when plans are undefined", () => {
    render(<UpgradeFlow orgId="org-1" />);
    expect(screen.getByText("Choose your plan")).toBeInTheDocument();
    expect(screen.getByText("Loading pricing plans...")).toBeInTheDocument();
  });

  it("renders plan cards when plans are available", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "plan-1",
        slug: "crucible",
        displayName: "Crucible",
        tagline: "For solo builders",
        monthlyPriceUsd: 49,
        overageRateUsd: 2.5,
        limits: { maxSeats: 3, maxPrograms: 3, maxSessionsPerMonth: 50 },
        features: ["Basic support", "AI sandbox"],
        buyingMotion: "self_serve",
        sortOrder: 1,
      },
      {
        _id: "plan-2",
        slug: "forge",
        displayName: "Forge",
        tagline: "For growing teams",
        monthlyPriceUsd: 149,
        overageRateUsd: 2.0,
        limits: { maxSeats: 10, maxPrograms: -1, maxSessionsPerMonth: 300 },
        features: ["Priority support", "AI sandbox", "Custom domains"],
        buyingMotion: "self_serve",
        sortOrder: 2,
      },
    ]);

    render(<UpgradeFlow orgId="org-1" />);
    expect(screen.getByText("Crucible")).toBeInTheDocument();
    expect(screen.getByText("Forge")).toBeInTheDocument();
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("$149")).toBeInTheDocument();
  });

  it("shows Most Popular badge for forge plan", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "plan-2",
        slug: "forge",
        displayName: "Forge",
        tagline: "For growing teams",
        monthlyPriceUsd: 149,
        overageRateUsd: 2.0,
        limits: { maxSeats: 10, maxPrograms: -1, maxSessionsPerMonth: 300 },
        features: ["Priority support"],
        buyingMotion: "self_serve",
        sortOrder: 2,
      },
    ]);

    render(<UpgradeFlow orgId="org-1" />);
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("shows Current Plan badge for current plan", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        _id: "plan-1",
        slug: "crucible",
        displayName: "Crucible",
        tagline: "For solo builders",
        monthlyPriceUsd: 49,
        overageRateUsd: 2.5,
        limits: { maxSeats: 3, maxPrograms: 3, maxSessionsPerMonth: 50 },
        features: ["Basic support"],
        buyingMotion: "self_serve",
        sortOrder: 1,
      },
    ]);

    render(<UpgradeFlow orgId="org-1" currentPlanSlug="crucible" />);
    expect(screen.getByText("Current Plan", { selector: "span" })).toBeInTheDocument();
  });
});
