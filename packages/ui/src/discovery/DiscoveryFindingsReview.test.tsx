import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let mockFindings: any;
let mockRequirements: any;

vi.mock("convex/react", () => ({
  useQuery: (ref: string) => {
    if (ref === "discoveryFindings:listByProgram") return mockFindings;
    if (ref === "requirements:listByProgram") return mockRequirements;
    return undefined;
  },
  useMutation: () => vi.fn(),
}));

vi.mock("../theme/useAnimations", () => ({
  useSlideReveal: vi.fn(),
}));

import { DiscoveryFindingsReview } from "./DiscoveryFindingsReview";

describe("DiscoveryFindingsReview", () => {
  const defaultProps = {
    programId: "prog-1",
    orgId: "org-1",
    activeTab: "requirement" as const,
    onTabChange: vi.fn(),
  };

  it("renders loading state when findings are undefined", () => {
    mockFindings = undefined;
    mockRequirements = undefined;
    render(<DiscoveryFindingsReview {...defaultProps} />);
    expect(screen.getByText("Loading findings...")).toBeInTheDocument();
  });

  it("renders empty state when findings are empty", () => {
    mockFindings = [];
    mockRequirements = [];
    render(<DiscoveryFindingsReview {...defaultProps} />);
    expect(screen.getByText(/No findings available yet/)).toBeInTheDocument();
  });

  it("renders tab buttons for finding types that exist", () => {
    mockFindings = [
      {
        _id: "f1",
        type: "requirement",
        confidence: "high",
        status: "pending",
        data: { title: "Cart Migration" },
      },
      {
        _id: "f2",
        type: "risk",
        confidence: "medium",
        status: "pending",
        data: { title: "Data Loss Risk" },
      },
    ];
    mockRequirements = [];
    render(<DiscoveryFindingsReview {...defaultProps} />);
    expect(screen.getByText(/Requirements/)).toBeInTheDocument();
    expect(screen.getByText(/Risks/)).toBeInTheDocument();
  });

  it("renders status summary counts", () => {
    mockFindings = [
      {
        _id: "f1",
        type: "requirement",
        confidence: "high",
        status: "pending",
        data: { title: "Test" },
      },
      {
        _id: "f2",
        type: "requirement",
        confidence: "medium",
        status: "approved",
        data: { title: "Test 2" },
      },
    ];
    mockRequirements = [];
    render(<DiscoveryFindingsReview {...defaultProps} />);
    expect(screen.getByText(/2 total/)).toBeInTheDocument();
    expect(screen.getByText(/1 pending/)).toBeInTheDocument();
    expect(screen.getByText(/1 approved/)).toBeInTheDocument();
  });

  it("renders finding cards", () => {
    mockFindings = [
      {
        _id: "f1",
        type: "requirement",
        confidence: "high",
        status: "pending",
        data: { title: "Cart Migration", description: "Migrate cart data" },
      },
    ];
    mockRequirements = [];
    render(<DiscoveryFindingsReview {...defaultProps} />);
    expect(screen.getByText("Cart Migration")).toBeInTheDocument();
  });

  it("renders Approve All In Tab and Reject All In Tab buttons", () => {
    mockFindings = [
      {
        _id: "f1",
        type: "requirement",
        confidence: "high",
        status: "pending",
        data: { title: "Test" },
      },
    ];
    mockRequirements = [];
    render(<DiscoveryFindingsReview {...defaultProps} />);
    expect(screen.getByText("Approve All In Tab")).toBeInTheDocument();
    expect(screen.getByText("Reject All In Tab")).toBeInTheDocument();
  });

  it("renders Import Approved button with count", () => {
    mockFindings = [
      {
        _id: "f1",
        type: "requirement",
        confidence: "high",
        status: "approved",
        data: { title: "Test" },
      },
    ];
    mockRequirements = [];
    render(<DiscoveryFindingsReview {...defaultProps} />);
    expect(screen.getByText("Import Approved (1)")).toBeInTheDocument();
  });
});
