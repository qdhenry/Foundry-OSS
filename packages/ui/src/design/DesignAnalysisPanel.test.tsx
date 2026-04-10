import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react — MUST be before component import
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn(() => vi.fn());

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: (...args: any[]) => mockUseMutation(...args),
  useAction: () => vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock @untitledui/icons with the named exports used by DesignAnalysisPanel
vi.mock("@untitledui/icons", () => ({
  XClose: () => null,
  Download01: () => null,
}));

import { DesignAnalysisPanel } from "./DesignAnalysisPanel";

const BASE_PROPS = {
  assetId: "asset-1",
  assetName: "My Screenshot",
  programId: "prog-1",
  onClose: vi.fn(),
};

const ANALYSIS_WITH_COLORS = {
  _id: "analysis-1",
  extractedColors: [
    { name: "Primary Blue", hex: "#3B82F6" },
    { name: "Slate Gray", hex: "#64748B" },
  ],
  extractedTypography: [],
  extractedComponents: [],
  extractedLayout: null,
  summary: null,
};

const ANALYSIS_WITH_COMPONENTS = {
  _id: "analysis-2",
  extractedColors: [],
  extractedTypography: [],
  extractedComponents: [
    { name: "PrimaryButton", type: "button", description: "Main CTA button" },
    { name: "NavBar", type: "navigation", description: "Top navigation" },
  ],
  extractedLayout: null,
  summary: null,
};

describe("DesignAnalysisPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    BASE_PROPS.onClose = vi.fn();
    mockUseQuery.mockReturnValue(null);
  });

  it("renders nothing when open is false", () => {
    render(<DesignAnalysisPanel {...BASE_PROPS} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders colors section when analysis has extractedColors", () => {
    mockUseQuery.mockReturnValue(ANALYSIS_WITH_COLORS);
    render(<DesignAnalysisPanel {...BASE_PROPS} open={true} />);
    expect(screen.getByText("Primary Blue")).toBeInTheDocument();
    expect(screen.getByText("Slate Gray")).toBeInTheDocument();
  });

  it("renders components section when analysis has extractedComponents", () => {
    mockUseQuery.mockReturnValue(ANALYSIS_WITH_COMPONENTS);
    render(<DesignAnalysisPanel {...BASE_PROPS} open={true} />);
    expect(screen.getByText("PrimaryButton")).toBeInTheDocument();
    expect(screen.getByText("NavBar")).toBeInTheDocument();
  });

  it("renders 'Use as Design Tokens' button when analysis has colors", () => {
    mockUseQuery.mockReturnValue(ANALYSIS_WITH_COLORS);
    render(<DesignAnalysisPanel {...BASE_PROPS} open={true} />);
    expect(screen.getByText("Use as Design Tokens")).toBeInTheDocument();
  });

  it("calls onClose when Escape key is pressed", () => {
    mockUseQuery.mockReturnValue(null);
    render(<DesignAnalysisPanel {...BASE_PROPS} open={true} />);
    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    expect(BASE_PROPS.onClose).toHaveBeenCalledTimes(1);
  });
});
