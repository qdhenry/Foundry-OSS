import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockAddApproval = vi.fn().mockResolvedValue(undefined);
const mockUpdateApproval = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: (name: string) => {
    if (name.includes("addApproval")) return mockAddApproval;
    return mockUpdateApproval;
  },
}));

import { ApprovalPanel } from "./ApprovalPanel";

const approvals = [
  { userId: "u1", role: "Architect", status: "pending" as const, userName: "Alice" },
  {
    userId: "u2",
    role: "QA Lead",
    status: "approved" as const,
    userName: "Bob",
    timestamp: Date.now(),
  },
];

describe("ApprovalPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows empty state when no approvals and not editable", () => {
    render(<ApprovalPanel gateId="g1" approvals={[]} isEditable={false} />);
    expect(screen.getByText("No approvals required yet")).toBeInTheDocument();
    expect(screen.queryByText("Add Approval")).not.toBeInTheDocument();
  });

  it("shows add button in empty state when editable", () => {
    render(<ApprovalPanel gateId="g1" approvals={[]} isEditable={true} />);
    expect(screen.getByText("Add Approval")).toBeInTheDocument();
  });

  it("renders approval list with names and roles", () => {
    render(<ApprovalPanel gateId="g1" approvals={approvals} isEditable={false} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Architect")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("QA Lead")).toBeInTheDocument();
  });

  it("shows status badges for each approval", () => {
    render(<ApprovalPanel gateId="g1" approvals={approvals} isEditable={false} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("shows approve/decline buttons when editable and pending approvals exist", () => {
    render(<ApprovalPanel gateId="g1" approvals={approvals} isEditable={true} />);
    expect(screen.getByText("Approve")).toBeInTheDocument();
    expect(screen.getByText("Decline")).toBeInTheDocument();
  });

  it("does not show approve/decline buttons when not editable", () => {
    render(<ApprovalPanel gateId="g1" approvals={approvals} isEditable={false} />);
    expect(screen.queryByText("Approve")).not.toBeInTheDocument();
    expect(screen.queryByText("Decline")).not.toBeInTheDocument();
  });

  it("calls updateApproval with approved status on approve click", () => {
    render(<ApprovalPanel gateId="g1" approvals={approvals} isEditable={true} />);
    fireEvent.click(screen.getByText("Approve"));
    expect(mockUpdateApproval).toHaveBeenCalledWith({
      gateId: "g1",
      status: "approved",
    });
  });

  it("shows add approval form on button click", () => {
    render(<ApprovalPanel gateId="g1" approvals={approvals} isEditable={true} />);
    fireEvent.click(screen.getByText("+ Add Approval"));
    expect(screen.getByPlaceholderText(/Role/)).toBeInTheDocument();
  });

  it("renders initial letter avatar for each approval", () => {
    render(<ApprovalPanel gateId="g1" approvals={approvals} isEditable={false} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
});
