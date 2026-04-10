import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalPanel } from "./ApprovalPanel";

const mockAddApproval = vi.fn();
const mockUpdateApproval = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (name: string) => {
    if (name === "sprintGates:addApproval") return mockAddApproval;
    if (name === "sprintGates:updateApproval") return mockUpdateApproval;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    sprintGates: {
      addApproval: "sprintGates:addApproval",
      updateApproval: "sprintGates:updateApproval",
    },
  },
}));

function makeApproval(overrides = {}) {
  return {
    userId: "user-1",
    role: "Architect",
    status: "pending" as const,
    userName: "Jane Doe",
    ...overrides,
  };
}

describe("ApprovalPanel", () => {
  beforeEach(() => {
    mockAddApproval.mockReset();
    mockUpdateApproval.mockReset();
  });

  it("renders empty state when no approvals", () => {
    render(<ApprovalPanel gateId="gate-1" approvals={[]} isEditable={true} />);
    expect(screen.getByText("No approvals required yet")).toBeInTheDocument();
  });

  it("shows Add Approval button in empty state when editable", () => {
    render(<ApprovalPanel gateId="gate-1" approvals={[]} isEditable={true} />);
    expect(screen.getByText("Add Approval")).toBeInTheDocument();
  });

  it("hides Add Approval button in empty state when not editable", () => {
    render(<ApprovalPanel gateId="gate-1" approvals={[]} isEditable={false} />);
    expect(screen.queryByText("Add Approval")).not.toBeInTheDocument();
  });

  it("renders approval cards with user initials", () => {
    render(<ApprovalPanel gateId="gate-1" approvals={[makeApproval()]} isEditable={false} />);
    expect(screen.getByText("J")).toBeInTheDocument(); // initial
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Architect")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows Approve/Decline buttons when editable and has pending approvals", () => {
    render(
      <ApprovalPanel
        gateId="gate-1"
        approvals={[makeApproval({ status: "pending" })]}
        isEditable={true}
      />,
    );
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("hides Approve/Decline buttons when not editable", () => {
    render(
      <ApprovalPanel
        gateId="gate-1"
        approvals={[makeApproval({ status: "pending" })]}
        isEditable={false}
      />,
    );
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Decline")).not.toBeInTheDocument();
  });

  it("calls updateApproval when Approve is clicked", async () => {
    mockUpdateApproval.mockResolvedValue(undefined);
    render(<ApprovalPanel gateId="gate-1" approvals={[makeApproval()]} isEditable={true} />);
    fireEvent.click(screen.getByText("Approve"));
    await waitFor(() => {
      expect(mockUpdateApproval).toHaveBeenCalledWith({
        gateId: "gate-1",
        status: "approved",
      });
    });
  });

  it("renders approved status correctly", () => {
    render(
      <ApprovalPanel
        gateId="gate-1"
        approvals={[makeApproval({ status: "approved" })]}
        isEditable={false}
      />,
    );
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("renders declined status correctly", () => {
    render(
      <ApprovalPanel
        gateId="gate-1"
        approvals={[makeApproval({ status: "declined" })]}
        isEditable={false}
      />,
    );
    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  it("shows add approval form when + Add Approval is clicked", () => {
    render(<ApprovalPanel gateId="gate-1" approvals={[makeApproval()]} isEditable={true} />);
    fireEvent.click(screen.getByText("+ Add Approval"));
    expect(screen.getByPlaceholderText("Role (e.g. Architect, QA Lead)")).toBeInTheDocument();
  });

  it("shows timestamp when approval has timestamp", () => {
    const ts = new Date("2025-01-15").getTime();
    render(
      <ApprovalPanel
        gateId="gate-1"
        approvals={[makeApproval({ timestamp: ts })]}
        isEditable={false}
      />,
    );
    expect(screen.getByText(new Date(ts).toLocaleDateString())).toBeInTheDocument();
  });
});
