import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DependencySuggestions } from "./DependencySuggestions";

let mockSuggestions: any;
const mockApproveDep = vi.fn().mockResolvedValue(undefined);
const mockDismissDep = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: (fnRef: string) => {
    if (fnRef === "dependencyDetection:approveDependency") return mockApproveDep;
    if (fnRef === "dependencyDetection:dismissDependency") return mockDismissDep;
    return vi.fn();
  },
  useAction: () => vi.fn(),
  useQuery: () => mockSuggestions,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    dependencyDetection: {
      getPendingSuggestions: "dependencyDetection:getPendingSuggestions",
      approveDependency: "dependencyDetection:approveDependency",
      dismissDependency: "dependencyDetection:dismissDependency",
    },
  },
}));

vi.mock("../../../convex/_generated/dataModel", () => ({}));

const mockSuggestionData = [
  {
    _id: "dep-1",
    sourceWorkstream: { _id: "ws-1", name: "Checkout Flow", shortCode: "WS-4" },
    targetWorkstream: { _id: "ws-2", name: "ERP Integration", shortCode: "WS-5" },
    description: "Checkout API depends on ERP order sync",
    dependencyType: "blocks",
    aiConfidence: 85,
    status: "suggested",
  },
  {
    _id: "dep-2",
    sourceWorkstream: { _id: "ws-3", name: "Data Migration", shortCode: "WS-2" },
    targetWorkstream: { _id: "ws-1", name: "Checkout Flow", shortCode: "WS-4" },
    description: "Customer data migration enables checkout testing",
    dependencyType: "enables",
    aiConfidence: 62,
    status: "suggested",
  },
];

const defaultProps = { programId: "prog-1" as any };

describe("DependencySuggestions", () => {
  beforeEach(() => {
    mockSuggestions = undefined;
    mockApproveDep.mockClear();
    mockDismissDep.mockClear();
  });

  it("shows loading skeleton when query returns undefined", () => {
    mockSuggestions = undefined;
    const { container } = render(<DependencySuggestions {...defaultProps} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders nothing when query returns empty array", () => {
    mockSuggestions = [];
    const { container } = render(<DependencySuggestions {...defaultProps} />);
    // Component returns null for empty suggestions
    expect(container.innerHTML).toBe("");
  });

  it("renders suggestion cards with source and target workstream names", () => {
    mockSuggestions = mockSuggestionData;
    const { container } = render(<DependencySuggestions {...defaultProps} />);
    // Names are split across child elements within <p>; check textContent of parent
    const nameElements = container.querySelectorAll("p.font-medium");
    const cardTexts = Array.from(nameElements).map((el) => el.textContent);
    expect(
      cardTexts.some((t) => t?.includes("Checkout Flow") && t?.includes("ERP Integration")),
    ).toBe(true);
    expect(
      cardTexts.some((t) => t?.includes("Data Migration") && t?.includes("Checkout Flow")),
    ).toBe(true);
  });

  it("shows description text for each suggestion", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    expect(screen.getByText("Checkout API depends on ERP order sync")).toBeTruthy();
    expect(screen.getByText("Customer data migration enables checkout testing")).toBeTruthy();
  });

  it("shows confidence badge with percentage", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    expect(screen.getByText("85% confidence")).toBeTruthy();
    expect(screen.getByText("62% confidence")).toBeTruthy();
  });

  it("applies green color for high confidence (>=80)", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    const highBadge = screen.getByText("85% confidence");
    expect(highBadge.className).toContain("bg-green-100");
    expect(highBadge.className).toContain("text-green-800");
  });

  it("applies amber color for medium confidence (60-79)", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    const medBadge = screen.getByText("62% confidence");
    expect(medBadge.className).toContain("bg-amber-100");
    expect(medBadge.className).toContain("text-amber-800");
  });

  it("applies slate color for low confidence (<60)", () => {
    mockSuggestions = [
      {
        _id: "dep-3",
        sourceWorkstream: { _id: "ws-1", name: "WS A" },
        targetWorkstream: { _id: "ws-2", name: "WS B" },
        description: "Low confidence link",
        dependencyType: "conflicts",
        aiConfidence: 40,
        status: "suggested",
      },
    ];
    render(<DependencySuggestions {...defaultProps} />);
    const badge = screen.getByText("40% confidence");
    expect(badge.className).toContain("bg-slate-100");
  });

  it("shows dependency type labels", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    expect(screen.getByText("Blocks")).toBeTruthy();
    expect(screen.getByText("Enables")).toBeTruthy();
  });

  it("renders Approve and Dismiss buttons for each suggestion", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    const dismissButtons = screen.getAllByRole("button", { name: "Dismiss" });
    expect(approveButtons).toHaveLength(2);
    expect(dismissButtons).toHaveLength(2);
  });

  it("calls approveDependency mutation when Approve is clicked", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    fireEvent.click(approveButtons[0]);
    expect(mockApproveDep).toHaveBeenCalledWith({ dependencyId: "dep-1" });
  });

  it("calls dismissDependency mutation when Dismiss is clicked", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    const dismissButtons = screen.getAllByRole("button", { name: "Dismiss" });
    fireEvent.click(dismissButtons[0]);
    expect(mockDismissDep).toHaveBeenCalledWith({ dependencyId: "dep-1" });
  });

  it("shows pending count in the heading", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    expect(screen.getByText("(2 pending review)")).toBeTruthy();
  });

  it("shows the section heading", () => {
    mockSuggestions = mockSuggestionData;
    render(<DependencySuggestions {...defaultProps} />);
    expect(screen.getByText("AI-Suggested Dependencies")).toBeTruthy();
  });

  it("shows Conflicts type label", () => {
    mockSuggestions = [
      {
        _id: "dep-3",
        sourceWorkstream: { _id: "ws-1", name: "WS A" },
        targetWorkstream: { _id: "ws-2", name: "WS B" },
        description: "A conflict",
        dependencyType: "conflicts",
        aiConfidence: 50,
        status: "suggested",
      },
    ];
    render(<DependencySuggestions {...defaultProps} />);
    expect(screen.getByText("Conflicts")).toBeTruthy();
  });
});
