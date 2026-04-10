import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaunchStep } from "./LaunchStep";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockFindings: any[] | undefined;
const mockImportFindings = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: () => mockFindings,
  useMutation: () => mockImportFindings,
  useAction: () => vi.fn(),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    discoveryFindings: {
      listByProgram: "discoveryFindings:listByProgram",
      importApprovedFindings: "discoveryFindings:importApprovedFindings",
    },
  },
}));

vi.mock("../../../../convex/_generated/dataModel", () => ({}));

const mockOnLaunch = vi.fn();
const mockOnBack = vi.fn();

const defaultProps = {
  programId: "prog-1",
  onLaunch: mockOnLaunch,
  onBack: mockOnBack,
};

beforeEach(() => {
  mockFindings = undefined;
  mockOnLaunch.mockClear();
  mockOnBack.mockClear();
  mockImportFindings.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LaunchStep", () => {
  it("renders heading and loading state when findings undefined", () => {
    mockFindings = undefined;

    render(<LaunchStep {...defaultProps} />);

    expect(screen.getByText("Launch Program")).toBeInTheDocument();
    expect(screen.getByText("Loading summary...")).toBeInTheDocument();
  });

  it("shows summary cards with counts of approved findings by type", () => {
    mockFindings = [
      { type: "requirement", status: "approved" },
      { type: "requirement", status: "approved" },
      { type: "requirement", status: "edited" },
      { type: "risk", status: "approved" },
      { type: "integration", status: "approved" },
      { type: "integration", status: "approved" },
      { type: "decision", status: "edited" },
      // These should not be counted
      { type: "requirement", status: "pending" },
      { type: "risk", status: "rejected" },
    ];

    const { container } = render(<LaunchStep {...defaultProps} />);

    // Verify all 4 category labels are present
    expect(screen.getByText("Requirements")).toBeInTheDocument();
    expect(screen.getByText("Risks")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Decisions")).toBeInTheDocument();

    // Verify counts via the bold count elements
    const countElements = container.querySelectorAll("p.text-2xl.font-bold");
    const counts = Array.from(countElements).map((el) => el.textContent);
    // Requirements: 3, Risks: 1, Integrations: 2, Decisions: 1
    expect(counts).toEqual(["3", "1", "2", "1"]);
  });

  it("shows empty state when no approved findings", () => {
    mockFindings = [
      { type: "requirement", status: "rejected" },
      { type: "risk", status: "pending" },
    ];

    render(<LaunchStep {...defaultProps} />);

    expect(screen.getByText(/No approved findings to import/)).toBeInTheDocument();
  });

  it("shows Launch Program button", () => {
    mockFindings = [{ type: "requirement", status: "approved" }];

    render(<LaunchStep {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Launch Program" })).toBeInTheDocument();
  });

  it("calls importFindings on launch click", async () => {
    mockImportFindings.mockResolvedValue({
      requirements: 2,
      risks: 1,
      integrations: 0,
      decisions: 0,
    });

    mockFindings = [
      { type: "requirement", status: "approved" },
      { type: "requirement", status: "approved" },
      { type: "risk", status: "approved" },
    ];

    render(<LaunchStep {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Launch Program" }));

    expect(mockImportFindings).toHaveBeenCalledOnce();
  });

  it("shows success state after import completes", async () => {
    mockImportFindings.mockResolvedValue({
      requirements: 5,
      risks: 2,
      integrations: 1,
      decisions: 3,
    });

    mockFindings = [{ type: "requirement", status: "approved" }];

    render(<LaunchStep {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Launch Program" }));

    // Wait for async import to complete
    const successHeading = await screen.findByText("Program Launched!");
    expect(successHeading).toBeInTheDocument();

    expect(
      screen.getByText(/Imported 5 requirements, 2 risks, 1 integrations, 3 decisions/),
    ).toBeInTheDocument();
    expect(screen.getByText("Redirecting to Mission Control...")).toBeInTheDocument();
  });

  it("disables button during import", async () => {
    // Make import hang
    mockImportFindings.mockReturnValue(new Promise(() => {}));

    mockFindings = [{ type: "requirement", status: "approved" }];

    render(<LaunchStep {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Launch Program" }));

    // Button should show launching state
    const launchingBtn = await screen.findByRole("button", {
      name: "Launching...",
    });
    expect(launchingBtn).toBeDisabled();
  });

  it("Back button calls onBack", () => {
    mockFindings = [];

    render(<LaunchStep {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(mockOnBack).toHaveBeenCalledOnce();
  });

  it("shows zero counts when findings array is empty", () => {
    mockFindings = [];

    render(<LaunchStep {...defaultProps} />);

    // All counts should be 0
    const zeroes = screen.getAllByText("0");
    expect(zeroes).toHaveLength(4);
  });
});
