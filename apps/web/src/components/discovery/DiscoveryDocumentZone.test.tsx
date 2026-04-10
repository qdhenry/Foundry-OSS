import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryDocumentZone } from "./DiscoveryDocumentZone";

let mockDocuments: any[] | undefined;
const mockGenerateUploadUrl = vi.fn();
const mockSaveDocument = vi.fn();
const mockUpdateDocument = vi.fn();
const mockRemoveDocument = vi.fn();
const mockQueueBatchAnalysis = vi.fn();
const mockCategorizeDocument = vi.fn();

const mockUploadQueue = {
  files: [] as any[],
  addFiles: vi.fn(),
  removeFile: vi.fn(),
  retryFile: vi.fn(),
  retryAllFailed: vi.fn(),
  updateCategory: vi.fn(),
  allDone: true,
  hasErrors: false,
  completedDocumentIds: [] as string[],
  isUploading: false,
};

vi.mock("convex/react", () => ({
  useQuery: (fnRef: string) => {
    if (fnRef === "documents:listByProgram") return mockDocuments;
    return undefined;
  },
  useMutation: (fnRef: string) => {
    if (fnRef === "documents:generateUploadUrl") return mockGenerateUploadUrl;
    if (fnRef === "documents:save") return mockSaveDocument;
    if (fnRef === "documents:update") return mockUpdateDocument;
    if (fnRef === "documents:remove") return mockRemoveDocument;
    return vi.fn();
  },
  useAction: (fnRef: string) => {
    if (fnRef === "documentAnalysisActions:queueBatchAnalysis") return mockQueueBatchAnalysis;
    if (fnRef === "documents:categorize") return mockCategorizeDocument;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    documents: {
      listByProgram: "documents:listByProgram",
      generateUploadUrl: "documents:generateUploadUrl",
      save: "documents:save",
      update: "documents:update",
      remove: "documents:remove",
      categorize: "documents:categorize",
    },
    documentAnalysisActions: {
      queueBatchAnalysis: "documentAnalysisActions:queueBatchAnalysis",
    },
  },
}));

vi.mock("@/hooks/useUploadQueue", () => ({
  useUploadQueue: () => mockUploadQueue,
}));

function makeDocument(overrides: Partial<any>): any {
  return {
    _id: "doc-1",
    _creationTime: 1,
    fileName: "doc-1.pdf",
    fileSize: 1024,
    category: "architecture",
    analysisStatus: "none",
    ...overrides,
  };
}

const defaultProps = {
  programId: "prog-1",
  orgId: "org-1",
  targetPlatform: "salesforce_b2b" as const,
  sortOrder: "oldest" as const,
  onSortOrderChange: vi.fn(),
};

describe("DiscoveryDocumentZone", () => {
  beforeEach(() => {
    mockDocuments = [];
    mockGenerateUploadUrl.mockReset();
    mockSaveDocument.mockReset();
    mockUpdateDocument.mockReset();
    mockRemoveDocument.mockReset();
    mockQueueBatchAnalysis.mockReset();
    mockCategorizeDocument.mockReset();
    mockUploadQueue.addFiles.mockReset();
    mockUploadQueue.completedDocumentIds = [];
    mockUploadQueue.files = [];
    mockUpdateDocument.mockResolvedValue(undefined);
    mockQueueBatchAnalysis.mockResolvedValue(undefined);
  });

  it("rejects unsupported extension and files over 50MB with inline errors", () => {
    mockDocuments = [];
    const { container } = render(<DiscoveryDocumentZone {...defaultProps} />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    const unsupported = new File(["bad"], "malware.exe", { type: "application/octet-stream" });
    const tooLarge = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(tooLarge, "size", { value: 50 * 1024 * 1024 + 1 });

    fireEvent.change(fileInput, {
      target: { files: [unsupported, tooLarge] },
    });

    expect(screen.getByText("Upload validation issues")).toBeInTheDocument();
    expect(screen.getByText(/malware\.exe: unsupported type \.exe/)).toBeInTheDocument();
    expect(screen.getByText(/huge\.pdf: exceeds 50MB/)).toBeInTheDocument();
    expect(mockUploadQueue.addFiles).not.toHaveBeenCalled();
  });

  it("queues analysis for at most 10 documents from unanalyzed list", async () => {
    mockDocuments = Array.from({ length: 12 }, (_, index) =>
      makeDocument({
        _id: `doc-${index + 1}`,
        fileName: `doc-${index + 1}.pdf`,
        _creationTime: index + 1,
        analysisStatus: "none",
      }),
    );

    render(<DiscoveryDocumentZone {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze 10 Documents" }));

    await waitFor(() => {
      expect(mockQueueBatchAnalysis).toHaveBeenCalledWith({
        orgId: "org-1",
        programId: "prog-1",
        documentIds: [
          "doc-1",
          "doc-2",
          "doc-3",
          "doc-4",
          "doc-5",
          "doc-6",
          "doc-7",
          "doc-8",
          "doc-9",
          "doc-10",
        ],
        targetPlatform: "salesforce_b2b",
        focusArea: undefined,
        customInstructions: undefined,
      });
    });
  });

  it("calls documents.update when category is changed", async () => {
    mockDocuments = [
      makeDocument({ _id: "doc-7", fileName: "architecture.md", category: "architecture" }),
    ];

    render(<DiscoveryDocumentZone {...defaultProps} />);

    const row = screen.getByText("architecture.md").closest("tr");
    if (!row) throw new Error("Expected document row");

    fireEvent.change(within(row).getByDisplayValue("Architecture"), {
      target: { value: "testing" },
    });

    await waitFor(() => {
      expect(mockUpdateDocument).toHaveBeenCalledWith({
        documentId: "doc-7",
        category: "testing",
      });
    });
  });

  it("confirms re-analyze with selected platform, focus area, and custom instructions", async () => {
    mockDocuments = [
      makeDocument({ _id: "doc-9", fileName: "requirements.md", analysisStatus: "complete" }),
    ];

    render(<DiscoveryDocumentZone {...defaultProps} />);

    const row = screen.getByText("requirements.md").closest("tr");
    if (!row) throw new Error("Expected document row");
    fireEvent.click(within(row).getByRole("button", { name: "Re-analyze" }));

    await screen.findByText("Focus the next analysis run for this document.");

    fireEvent.change(screen.getByLabelText("Focus area"), {
      target: { value: "risks" },
    });
    fireEvent.change(screen.getByLabelText("Target platform"), {
      target: { value: "bigcommerce_b2b" },
    });
    fireEvent.change(screen.getByPlaceholderText("Optional instructions for the next run"), {
      target: { value: "  Prioritize API compatibility checks  " },
    });

    const reAnalyzeButtons = screen.getAllByRole("button", { name: "Re-analyze" });
    fireEvent.click(reAnalyzeButtons[reAnalyzeButtons.length - 1]);

    await waitFor(() => {
      expect(mockQueueBatchAnalysis).toHaveBeenCalledWith({
        orgId: "org-1",
        programId: "prog-1",
        documentIds: ["doc-9"],
        targetPlatform: "bigcommerce_b2b",
        focusArea: "risks",
        customInstructions: "Prioritize API compatibility checks",
      });
    });
  });
});
