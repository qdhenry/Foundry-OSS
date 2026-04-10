import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUpdateRequirement = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateRequirement,
}));

import { EditRequirementModal } from "./EditRequirementModal";

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  requirementId: "req_1",
  initialValues: {
    priority: "must_have" as const,
    status: "draft" as const,
    fitGap: "native" as const,
    effortEstimate: undefined as undefined,
    deliveryPhase: undefined as undefined,
  },
};

describe("EditRequirementModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<EditRequirementModal {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders modal title", () => {
    render(<EditRequirementModal {...defaultProps} />);
    expect(screen.getByText("Edit Requirement")).toBeInTheDocument();
  });

  it("renders all five select fields", () => {
    render(<EditRequirementModal {...defaultProps} />);
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Fit/Gap")).toBeInTheDocument();
    expect(screen.getByText("Effort Estimate")).toBeInTheDocument();
    expect(screen.getByText("Delivery Phase")).toBeInTheDocument();
  });

  it("renders priority options", () => {
    render(<EditRequirementModal {...defaultProps} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Should Have")).toBeInTheDocument();
    expect(screen.getByText("Nice to Have")).toBeInTheDocument();
    expect(screen.getByText("Deferred")).toBeInTheDocument();
  });

  it("renders save and cancel buttons", () => {
    render(<EditRequirementModal {...defaultProps} />);
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onClose on cancel click", () => {
    const onClose = vi.fn();
    render(<EditRequirementModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on overlay click", () => {
    const onClose = vi.fn();
    const { container } = render(<EditRequirementModal {...defaultProps} onClose={onClose} />);
    const overlay = container.querySelector(".fixed.inset-0");
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<EditRequirementModal {...defaultProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders effort estimate 'Not set' option", () => {
    render(<EditRequirementModal {...defaultProps} />);
    const notSetOptions = screen.getAllByText("Not set");
    expect(notSetOptions.length).toBeGreaterThanOrEqual(1);
  });

  it("calls mutation on save with changed fields", async () => {
    render(<EditRequirementModal {...defaultProps} />);
    const selects = screen.getAllByRole("combobox");
    // Change priority to should_have
    fireEvent.change(selects[0], { target: { value: "should_have" } });
    fireEvent.click(screen.getByText("Save"));
    // Mutation is called async
    await vi.waitFor(() => {
      expect(mockUpdateRequirement).toHaveBeenCalledWith(
        expect.objectContaining({
          requirementId: "req_1",
          priority: "should_have",
        }),
      );
    });
  });
});
