import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateRequirementForm } from "./CreateRequirementForm";

const mockCreateRequirement = vi.fn();
const mockOrganization: any = { id: "org_123" };

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: mockOrganization }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mockCreateRequirement,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { requirements: { create: "requirements:create" } },
}));

describe("CreateRequirementForm", () => {
  const defaultProps = {
    programId: "prog-1",
    workstreams: [{ _id: "ws-1", name: "Commerce" }],
    isOpen: true,
    onClose: vi.fn(),
  };

  it("renders nothing when isOpen is false", () => {
    const { container } = render(<CreateRequirementForm {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with title", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByRole("heading", { name: "Create Requirement" })).toBeInTheDocument();
  });

  it("renders all form fields", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByPlaceholderText("e.g. Product catalog data migration")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Detailed requirement description...")).toBeInTheDocument();
    expect(screen.getByText("Must Have")).toBeInTheDocument();
    expect(screen.getByText("Native")).toBeInTheDocument();
  });

  it("renders workstream options", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByText("Commerce")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("disables submit when title is empty", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    const submitBtn = screen
      .getAllByText("Create Requirement")
      .find((el) => el.tagName === "BUTTON" && el.getAttribute("type") === "submit");
    expect(submitBtn).toBeDisabled();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    render(<CreateRequirementForm {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
