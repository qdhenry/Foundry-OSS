import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManagedFile } from "@/hooks/useUploadQueue";
import { DocumentUploadStep } from "./DocumentUploadStep";

// ---------------------------------------------------------------------------
// Mock the upload queue hook
// ---------------------------------------------------------------------------

const mockQueue = {
  files: [] as ManagedFile[],
  addFiles: vi.fn(),
  removeFile: vi.fn(),
  retryFile: vi.fn(),
  retryAllFailed: vi.fn(),
  updateCategory: vi.fn(),
  allDone: false,
  hasErrors: false,
  completedDocumentIds: [] as string[],
  isUploading: false,
};

vi.mock("@/hooks/useUploadQueue", () => ({
  useUploadQueue: () => mockQueue,
}));

let googleDriveButtonProps: {
  onImportComplete?: (documentIds: string[]) => void;
  onImportingChange?: (isImporting: boolean) => void;
} | null = null;

vi.mock("@foundry/ui/google-drive", () => ({
  GoogleDriveImportButton: (props: any) => {
    googleDriveButtonProps = props;
    return <button type="button">Import from Drive</button>;
  },
}));

// Mock convex API
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    documents: {
      generateUploadUrl: "documents:generateUploadUrl",
      save: "documents:save",
    },
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManagedFile(overrides: Partial<ManagedFile> = {}): ManagedFile {
  return {
    id: "file-1",
    file: new File(["hello"], "test-doc.pdf", { type: "application/pdf" }),
    category: "other",
    status: "queued",
    progress: 0,
    error: null,
    documentId: null,
    abortController: null,
    ...overrides,
  };
}

const defaultProps = {
  programId: "prog-1",
  orgId: "org-1",
  onNext: vi.fn(),
  onBack: vi.fn(),
};

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockQueue.files = [];
  mockQueue.addFiles.mockClear();
  mockQueue.removeFile.mockClear();
  mockQueue.retryFile.mockClear();
  mockQueue.retryAllFailed.mockClear();
  mockQueue.updateCategory.mockClear();
  mockQueue.allDone = false;
  mockQueue.hasErrors = false;
  mockQueue.completedDocumentIds = [];
  mockQueue.isUploading = false;
  googleDriveButtonProps = null;
  defaultProps.onNext.mockClear();
  defaultProps.onBack.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocumentUploadStep", () => {
  it("renders drop zone with heading and instructions", () => {
    render(<DocumentUploadStep {...defaultProps} />);

    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
    expect(screen.getByText("Drag and drop files, or click to browse")).toBeInTheDocument();
    expect(screen.getByText("PDF, DOCX, XLSX, CSV, TXT, MD, PNG, JPG")).toBeInTheDocument();
  });

  it("file drop triggers addFiles", () => {
    render(<DocumentUploadStep {...defaultProps} />);

    const dropZone = screen
      .getByText("Drag and drop files, or click to browse")
      .closest("div[class*='border-dashed']")!;

    const file = new File(["content"], "gap-analysis.pdf", {
      type: "application/pdf",
    });
    const dataTransfer = {
      files: [file],
      types: ["Files"],
    };

    fireEvent.drop(dropZone, { dataTransfer });

    expect(mockQueue.addFiles).toHaveBeenCalledTimes(1);
  });

  it("shows status badges correctly for different statuses", () => {
    mockQueue.files = [
      makeManagedFile({ id: "f1", status: "queued" }),
      makeManagedFile({ id: "f2", status: "uploading", progress: 50 }),
      makeManagedFile({ id: "f3", status: "done", documentId: "doc-3" }),
      makeManagedFile({
        id: "f4",
        status: "failed",
        error: "Network error",
      }),
    ];

    render(<DocumentUploadStep {...defaultProps} />);

    const badges = screen.getAllByTestId("status-badge");
    const badgeTexts = badges.map((b) => b.textContent);

    expect(badgeTexts).toContain("Queued");
    expect(badgeTexts).toContain("Uploading");
    expect(badgeTexts).toContain("Done");
    expect(badgeTexts).toContain("Failed");
  });

  it("shows progress bar during uploading status", () => {
    mockQueue.files = [makeManagedFile({ id: "f1", status: "uploading", progress: 67 })];

    render(<DocumentUploadStep {...defaultProps} />);

    const fill = screen.getByTestId("progress-bar-fill");
    expect(fill).toBeInTheDocument();
    expect(fill).toHaveStyle({ width: "67%" });
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("remove button calls removeFile with correct id", () => {
    mockQueue.files = [makeManagedFile({ id: "file-abc", status: "queued" })];

    render(<DocumentUploadStep {...defaultProps} />);

    const removeBtn = screen.getByLabelText("Remove file");
    fireEvent.click(removeBtn);

    expect(mockQueue.removeFile).toHaveBeenCalledTimes(1);
    expect(mockQueue.removeFile).toHaveBeenCalledWith("file-abc");
  });

  it("retry button on failed files calls retryFile", () => {
    mockQueue.files = [
      makeManagedFile({
        id: "file-fail",
        status: "failed",
        error: "Timeout",
      }),
    ];

    render(<DocumentUploadStep {...defaultProps} />);

    const retryBtn = screen.getByLabelText("Retry upload");
    fireEvent.click(retryBtn);

    expect(mockQueue.retryFile).toHaveBeenCalledTimes(1);
    expect(mockQueue.retryFile).toHaveBeenCalledWith("file-fail");
  });

  it("Next button enabled when allDone is true", () => {
    mockQueue.files = [makeManagedFile({ id: "f1", status: "done", documentId: "doc-1" })];
    mockQueue.allDone = true;
    mockQueue.completedDocumentIds = ["doc-1"];

    render(<DocumentUploadStep {...defaultProps} />);

    const nextBtn = screen.getByRole("button", { name: "Next" });
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(defaultProps.onNext).toHaveBeenCalledWith({
      documentIdsToQueue: ["doc-1"],
      alreadyQueuedDocumentIds: [],
    });
  });

  it("shows disabled Uploading button when isUploading is true", () => {
    mockQueue.files = [makeManagedFile({ id: "f1", status: "uploading", progress: 30 })];
    mockQueue.isUploading = true;

    render(<DocumentUploadStep {...defaultProps} />);

    const uploadingBtn = screen.getByRole("button", { name: /Uploading/i });
    expect(uploadingBtn).toBeDisabled();
  });

  it("shows Skip button when no files and calls onNext with empty result", () => {
    mockQueue.files = [];

    render(<DocumentUploadStep {...defaultProps} />);

    const skipBtn = screen.getByRole("button", { name: "Skip" });
    expect(skipBtn).toBeInTheDocument();

    fireEvent.click(skipBtn);
    expect(defaultProps.onNext).toHaveBeenCalledWith({
      documentIdsToQueue: [],
      alreadyQueuedDocumentIds: [],
    });
  });

  it("summary bar shows correct counts for mixed statuses", () => {
    mockQueue.files = [
      makeManagedFile({ id: "f1", status: "done", documentId: "doc-1" }),
      makeManagedFile({ id: "f2", status: "done", documentId: "doc-2" }),
      makeManagedFile({
        id: "f3",
        status: "failed",
        error: "Error 1",
      }),
      makeManagedFile({
        id: "f4",
        status: "failed",
        error: "Error 2",
      }),
      makeManagedFile({ id: "f5", status: "queued" }),
    ];

    render(<DocumentUploadStep {...defaultProps} />);

    expect(screen.getByText("5 files")).toBeInTheDocument();
    expect(screen.getByText("2 uploaded")).toBeInTheDocument();
    expect(screen.getByText("2 failed")).toBeInTheDocument();
    expect(screen.getByText("Retry all")).toBeInTheDocument();
  });

  it("enables Next for successful Drive-only imports", () => {
    render(<DocumentUploadStep {...defaultProps} />);

    act(() => {
      googleDriveButtonProps?.onImportingChange?.(false);
      googleDriveButtonProps?.onImportComplete?.(["drive-doc-1", "drive-doc-2"]);
    });

    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);

    expect(defaultProps.onNext).toHaveBeenCalledWith({
      documentIdsToQueue: [],
      alreadyQueuedDocumentIds: ["drive-doc-1", "drive-doc-2"],
    });
  });
});
