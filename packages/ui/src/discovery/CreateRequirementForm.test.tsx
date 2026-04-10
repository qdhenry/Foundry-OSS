import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockCreateRequirement = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockCreateRequirement,
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org_test" } }),
}));

import { CreateRequirementForm } from "./CreateRequirementForm";

describe("CreateRequirementForm", () => {
  const defaultProps = {
    programId: "prog-1",
    workstreams: [
      { _id: "ws-1", name: "Payment" },
      { _id: "ws-2", name: "Catalog" },
    ],
    isOpen: true,
    onClose: vi.fn(),
  };

  it("returns null when isOpen is false", () => {
    const { container } = render(<CreateRequirementForm {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal heading", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByRole("heading", { name: "Create Requirement" })).toBeInTheDocument();
  });

  it("renders form fields", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByPlaceholderText("e.g. Product catalog data migration")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Detailed requirement description...")).toBeInTheDocument();
  });

  it("renders priority and fitgap selects", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Native")).toBeInTheDocument();
  });

  it("renders workstream options", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("disables submit when title is empty", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    const submitButtons = screen.getAllByRole("button");
    const createButton = submitButtons.find((b) => b.textContent === "Create Requirement");
    expect(createButton).toBeDisabled();
  });

  it("renders Cancel button", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });
});
