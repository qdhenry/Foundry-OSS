import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

import { RequirementDetailPanel } from "./RequirementDetailPanel";

const baseRequirement = {
  _id: "req_1",
  refId: "FOUND-01",
  title: "User Authentication",
  description: "Support SSO login with Clerk",
  programId: "prog_1",
  priority: "must_have",
  status: "approved",
  fitGap: "native",
  effortEstimate: "medium",
  deliveryPhase: "phase_1",
};

const defaultProps = {
  requirementId: "req_1",
  open: true,
  onClose: vi.fn(),
};

describe("RequirementDetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<RequirementDetailPanel {...defaultProps} open={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows loading spinner when requirement is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<RequirementDetailPanel {...defaultProps} />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders requirement title and ref ID", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name === "requirements:get") return baseRequirement;
      return undefined;
    });
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("FOUND-01")).toBeInTheDocument();
    expect(screen.getByText("User Authentication")).toBeInTheDocument();
  });

  it("renders description", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name === "requirements:get") return baseRequirement;
      return undefined;
    });
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Support SSO login with Clerk")).toBeInTheDocument();
  });

  it("renders metadata fields", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name === "requirements:get") return baseRequirement;
      return undefined;
    });
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Native")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.getByText("Phase 1")).toBeInTheDocument();
  });

  it("shows 'Not set' for missing effort/phase", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name === "requirements:get")
        return { ...baseRequirement, effortEstimate: undefined, deliveryPhase: undefined };
      return undefined;
    });
    render(<RequirementDetailPanel {...defaultProps} />);
    const notSetItems = screen.getAllByText("Not set");
    expect(notSetItems.length).toBe(2);
  });

  it("renders panel header with close button", () => {
    mockUseQuery.mockReturnValue(baseRequirement);
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Requirement Details")).toBeInTheDocument();
  });

  it("calls onClose on close button click", () => {
    const onClose = vi.fn();
    mockUseQuery.mockReturnValue(baseRequirement);
    render(<RequirementDetailPanel {...defaultProps} onClose={onClose} />);
    // Find the close button (the one in the header)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    mockUseQuery.mockReturnValue(baseRequirement);
    render(<RequirementDetailPanel {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders design assets when available", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name === "requirements:get") return baseRequirement;
      if (name === "designAssets:listByRequirement")
        return [
          {
            _id: "da1",
            name: "Login Screen",
            type: "screenshot",
            fileUrl: "https://example.com/img.png",
          },
          { _id: "da2", name: "Theme Tokens", type: "tokens" },
        ];
      return undefined;
    });
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Design Assets (2)")).toBeInTheDocument();
    expect(screen.getByText("Login Screen")).toBeInTheDocument();
    expect(screen.getByText("Theme Tokens")).toBeInTheDocument();
  });

  it("renders dependencies when available", () => {
    mockUseQuery.mockImplementation((name: string) => {
      if (name === "requirements:get")
        return {
          ...baseRequirement,
          resolvedDependencies: [{ _id: "dep1", refId: "FOUND-02", title: "User Profile" }],
        };
      return undefined;
    });
    render(<RequirementDetailPanel {...defaultProps} />);
    expect(screen.getByText("Dependencies (1)")).toBeInTheDocument();
    expect(screen.getByText("FOUND-02")).toBeInTheDocument();
    expect(screen.getByText("User Profile")).toBeInTheDocument();
  });
});
