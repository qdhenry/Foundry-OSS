import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryFindingsReview } from "./DiscoveryFindingsReview";

let mockFindings: any[] | undefined;
let mockRequirements: any[] | undefined;

const mockReviewFinding = vi.fn();
const mockBulkReviewFindings = vi.fn();
const mockImportApprovedFindings = vi.fn();
const mockMergeFindingIntoRequirement = vi.fn();
const mockRevertImport = vi.fn();
const mockAcquireLock = vi.fn();
const mockReleaseLock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (fnRef: string) => {
    if (fnRef === "discoveryFindings:listByProgram") return mockFindings;
    if (fnRef === "requirements:listByProgram") return mockRequirements;
    return undefined;
  },
  useMutation: (fnRef: string) => {
    if (fnRef === "discoveryFindings:reviewFinding") return mockReviewFinding;
    if (fnRef === "discoveryFindings:bulkReviewFindings") return mockBulkReviewFindings;
    if (fnRef === "discoveryFindings:importApprovedFindings") return mockImportApprovedFindings;
    if (fnRef === "discoveryFindings:mergeFindingIntoRequirement")
      return mockMergeFindingIntoRequirement;
    if (fnRef === "discoveryFindings:revertImport") return mockRevertImport;
    if (fnRef === "discoveryFindings:acquireLock") return mockAcquireLock;
    if (fnRef === "discoveryFindings:releaseLock") return mockReleaseLock;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    discoveryFindings: {
      listByProgram: "discoveryFindings:listByProgram",
      reviewFinding: "discoveryFindings:reviewFinding",
      bulkReviewFindings: "discoveryFindings:bulkReviewFindings",
      importApprovedFindings: "discoveryFindings:importApprovedFindings",
      mergeFindingIntoRequirement: "discoveryFindings:mergeFindingIntoRequirement",
      revertImport: "discoveryFindings:revertImport",
      acquireLock: "discoveryFindings:acquireLock",
      releaseLock: "discoveryFindings:releaseLock",
    },
    requirements: {
      listByProgram: "requirements:listByProgram",
    },
  },
}));

function makeFinding(overrides: Partial<any>): any {
  return {
    _id: "finding-1",
    type: "requirement",
    status: "pending",
    confidence: "high",
    data: {
      title: "Checkout requirement",
      description: "Description",
    },
    ...overrides,
  };
}

const defaultProps = {
  programId: "prog-1",
  orgId: "org-1",
  activeTab: "requirement" as const,
  onTabChange: vi.fn(),
};

describe("DiscoveryFindingsReview", () => {
  beforeEach(() => {
    mockFindings = [];
    mockRequirements = [];
    mockReviewFinding.mockReset();
    mockBulkReviewFindings.mockReset();
    mockImportApprovedFindings.mockReset();
    mockMergeFindingIntoRequirement.mockReset();
    mockRevertImport.mockReset();
    mockAcquireLock.mockReset();
    mockReleaseLock.mockReset();
    mockBulkReviewFindings.mockResolvedValue(undefined);
    mockImportApprovedFindings.mockResolvedValue({
      requirements: 1,
      risks: 0,
      integrations: 0,
      decisions: 0,
      tasks: 0,
    });
    mockMergeFindingIntoRequirement.mockResolvedValue(undefined);
    mockRevertImport.mockResolvedValue({ reverted: 2 });
    mockAcquireLock.mockResolvedValue({ acquired: true });
    mockReleaseLock.mockResolvedValue(undefined);
  });

  it("renders tab counts and bulk approve uses pending ids in active tab", async () => {
    mockFindings = [
      makeFinding({ _id: "f-1", type: "requirement", status: "pending" }),
      makeFinding({ _id: "f-2", type: "requirement", status: "pending" }),
      makeFinding({ _id: "f-3", type: "risk", status: "pending" }),
    ];

    render(<DiscoveryFindingsReview {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Requirements (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Risks (1)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve All In Tab" }));

    await waitFor(() => {
      expect(mockBulkReviewFindings).toHaveBeenCalledWith({
        findingIds: ["f-1", "f-2"],
        status: "approved",
      });
    });
  });

  it("imports approved findings with the selected status parameter", async () => {
    mockFindings = [
      makeFinding({ _id: "f-approved", status: "approved" }),
      makeFinding({ _id: "f-pending", status: "pending" }),
    ];

    render(<DiscoveryFindingsReview {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Import as"), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import Approved (1)" }));

    await waitFor(() => {
      expect(mockImportApprovedFindings).toHaveBeenCalledWith({
        programId: "prog-1",
        status: "active",
      });
    });
  });

  it("merges finding into a requirement when lock is acquired", async () => {
    mockFindings = [
      makeFinding({
        _id: "f-merge",
        status: "pending",
        data: {
          title: "Checkout requirement",
          description: "Needs PCI checks",
          potentialMatch: "Checkout requirement",
        },
      }),
    ];
    mockRequirements = [{ _id: "req-1", refId: "REQ-1", title: "Checkout requirement" }];

    render(<DiscoveryFindingsReview {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Merge into existing" }));
    fireEvent.click(screen.getByRole("button", { name: "Merge & Resolve" }));

    await waitFor(() => {
      expect(mockMergeFindingIntoRequirement).toHaveBeenCalledWith({
        findingId: "f-merge",
        requirementId: "req-1",
        mergeStrategy: "append_description",
      });
    });
    expect(mockReleaseLock).toHaveBeenCalledWith({ findingId: "f-merge" });
    expect(screen.getByText("Finding merged into existing requirement.")).toBeInTheDocument();
  });

  it("shows lock owner message and skips merge when lock is not acquired", async () => {
    mockAcquireLock.mockResolvedValue({
      acquired: false,
      lockedByName: "Jordan",
    });
    mockFindings = [
      makeFinding({
        _id: "f-locked",
        data: {
          title: "API auth requirement",
          potentialMatch: "API auth requirement",
        },
      }),
    ];
    mockRequirements = [{ _id: "req-2", refId: "REQ-2", title: "API auth requirement" }];

    render(<DiscoveryFindingsReview {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Merge into existing" }));
    fireEvent.click(screen.getByRole("button", { name: "Merge & Resolve" }));

    await waitFor(() => {
      expect(
        screen.getByText("Finding is currently being reviewed by Jordan."),
      ).toBeInTheDocument();
    });
    expect(mockMergeFindingIntoRequirement).not.toHaveBeenCalled();
  });

  it("calls revertImport after an import when revert button is shown", async () => {
    mockFindings = [
      makeFinding({ _id: "f-approved", status: "approved" }),
      makeFinding({ _id: "f-edited", status: "edited" }),
    ];

    render(<DiscoveryFindingsReview {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Import Approved (2)" }));
    await waitFor(() => {
      expect(mockImportApprovedFindings).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Revert Import" }));

    await waitFor(() => {
      expect(mockRevertImport).toHaveBeenCalledWith({
        findingIds: ["f-approved", "f-edited"],
      });
    });
  });
});
