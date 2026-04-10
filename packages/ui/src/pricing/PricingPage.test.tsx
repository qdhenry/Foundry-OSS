import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PricingPage } from "./PricingPage";

let mockPlansData: any;

vi.mock("convex/react", () => ({
  useQuery: () => mockPlansData,
  useMutation: () => vi.fn(),
}));

describe("PricingPage", () => {
  it("renders loading skeleton when plans are undefined", () => {
    mockPlansData = undefined;
    const { container } = render(<PricingPage />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("renders hero heading with fallback plans", () => {
    mockPlansData = [];
    render(<PricingPage />);
    expect(screen.getByText(/Ship software with AI agents/)).toBeInTheDocument();
  });

  it("renders three tier cards with fallback data", () => {
    mockPlansData = [];
    render(<PricingPage />);
    expect(screen.getByText("Crucible")).toBeInTheDocument();
    expect(screen.getByText("Forge")).toBeInTheDocument();
    expect(screen.getByText("Foundry")).toBeInTheDocument();
  });

  it("renders feature matrix", () => {
    mockPlansData = [];
    render(<PricingPage />);
    expect(screen.getByText("Compare plans")).toBeInTheDocument();
  });

  it("renders Smelt Experience section", () => {
    mockPlansData = [];
    render(<PricingPage />);
    expect(screen.getByText("Try Foundry Free")).toBeInTheDocument();
  });

  it("renders ROI calculator", () => {
    mockPlansData = [];
    render(<PricingPage />);
    expect(screen.getByText("Calculate your ROI")).toBeInTheDocument();
  });

  it("renders FAQ section", () => {
    mockPlansData = [];
    render(<PricingPage />);
    expect(screen.getByText("Frequently asked questions")).toBeInTheDocument();
  });

  it("renders CTA button", () => {
    mockPlansData = [];
    render(<PricingPage />);
    expect(screen.getByText("Start The Smelt — Free")).toBeInTheDocument();
  });
});
