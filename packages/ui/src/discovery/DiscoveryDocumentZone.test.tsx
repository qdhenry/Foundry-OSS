import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react — MUST be before component import
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => {
  const success = vi.fn();
  const error = vi.fn();
  const toastFn = Object.assign(vi.fn(), { success, error });
  return { toast: toastFn };
});

// Mock the ConfirmDialog to simplify testing
vi.mock("../dashboard-shell/ConfirmDialog", () => ({
  ConfirmDialog: ({ isOpen, title, description, onConfirm, onCancel }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <p>{description}</p>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>Confirm Delete</button>
      </div>
    );
  },
}));

// Mock useUploadQueue
vi.mock("./useUploadQueue", () => ({
  useUploadQueue: () => ({
    files: [],
    addFiles: vi.fn(),
    removeFile: vi.fn(),
    retryFile: vi.fn(),
    retryAllFailed: vi.fn(),
    updateCategory: vi.fn(),
    allDone: true,
    hasErrors: false,
    completedDocumentIds: [],
    isUploading: false,
  }),
}));

import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

const FAKE_DOCS = [
  {
    _id: "doc1",
    _creationTime: Date.now(),
    fileName: "test-document.docx",
    fileSize: 12345,
    category: "requirements",
    analysisStatus: "complete",
  },
  {
    _id: "doc2",
    _creationTime: Date.now() - 1000,
    fileName: "another-doc.pdf",
    fileSize: 67890,
    category: "architecture",
    analysisStatus: "complete",
  },
];

const mockRemoveDocument = vi.fn().mockResolvedValue(undefined);
const mockUpdateDocument = vi.fn().mockResolvedValue(undefined);

// Import component AFTER mocks
import { DiscoveryDocumentZone } from "./DiscoveryDocumentZone";

function renderZone() {
  return render(
    <DiscoveryDocumentZone
      programId="prog1"
      orgId="org1"
      targetPlatform="salesforce_b2b"
      sortOrder="newest"
      onSortOrderChange={vi.fn()}
    />,
  );
}

describe("DiscoveryDocumentZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // useQuery returns docs for the documents list, undefined for others
    (useQuery as any).mockImplementation((_name: string) => {
      if (_name === "documents:listByProgram") return FAKE_DOCS;
      return undefined;
    });
    (useMutation as any).mockImplementation((_name: string) => {
      if (_name === "documents:remove") return mockRemoveDocument;
      if (_name === "documents:update") return mockUpdateDocument;
      return vi.fn();
    });
    (useAction as any).mockReturnValue(vi.fn());
  });

  it("shows confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderZone();

    const deleteButtons = screen.getAllByText("Delete");
    await user.click(deleteButtons[0]);

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    // The filename appears both in the document table and in the dialog description
    expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
  });

  it("does not delete when Cancel is clicked in dialog", async () => {
    const user = userEvent.setup();
    renderZone();

    await user.click(screen.getAllByText("Delete")[0]);
    await user.click(screen.getByText("Cancel"));

    expect(mockRemoveDocument).not.toHaveBeenCalled();
    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });

  it("shows undo toast on confirm and hides doc from list", async () => {
    const user = userEvent.setup();
    renderZone();

    await user.click(screen.getAllByText("Delete")[0]);
    await user.click(screen.getByText("Confirm Delete"));

    // Should show toast (not call removeDocument yet)
    expect(toast).toHaveBeenCalled();
    expect(mockRemoveDocument).not.toHaveBeenCalled();
  });

  it("shows success toast when category is changed", async () => {
    const user = userEvent.setup();
    renderZone();

    // Find category selects — skip the first combobox (sort order select)
    const selects = screen.getAllByRole("combobox");
    // selects[0] is the sort dropdown, selects[1] is first doc's category
    await user.selectOptions(selects[1], "architecture");

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalled();
    });
    expect((toast as any).success).toHaveBeenCalledWith(expect.stringContaining("Architecture"));
  });

  it("shows batch action toolbar when a document checkbox is selected", async () => {
    const user = userEvent.setup();
    renderZone();

    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is "Select all", subsequent are per-document
    await user.click(checkboxes[1]);

    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete Selected/i)).toBeInTheDocument();
    expect(screen.getByText(/Re-analyze Selected/i)).toBeInTheDocument();
  });

  it("selects all documents when Select All checkbox is clicked", async () => {
    const user = userEvent.setup();
    renderZone();

    const selectAll = screen.getByLabelText("Select all documents");
    await user.click(selectAll);

    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });
});
