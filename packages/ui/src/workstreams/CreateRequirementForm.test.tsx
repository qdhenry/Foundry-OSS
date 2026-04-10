import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateRequirementForm } from "./CreateRequirementForm";

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

const mockMutate = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: () => mockMutate,
}));

const defaultProps = {
  programId: "prog-1",
  workstreams: [
    { _id: "ws-1", name: "Frontend" },
    { _id: "ws-2", name: "Backend" },
  ],
  isOpen: true,
  onClose: vi.fn(),
};

describe("CreateRequirementForm", () => {
  it("returns null when not open", () => {
    const { container } = render(<CreateRequirementForm {...defaultProps} isOpen={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders heading when open", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByText("Create Requirement")).toBeInTheDocument();
  });

  it("renders title input", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByPlaceholderText("e.g. Product catalog data migration")).toBeInTheDocument();
  });

  it("renders priority and fit/gap selects", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByDisplayValue("Must Have")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Native")).toBeInTheDocument();
  });

  it("renders workstream options", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("submit button disabled when title empty", () => {
    render(<CreateRequirementForm {...defaultProps} />);
    const btn = screen.getByText("Create Requirement");
    expect(btn).toBeDisabled();
  });

  it("calls onClose when cancel clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CreateRequirementForm {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalled();
  });
});
