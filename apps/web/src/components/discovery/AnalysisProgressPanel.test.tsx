import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalysisProgressPanel } from "./AnalysisProgressPanel";

let mockProgress: any[] | undefined;
let mockActivityLogs: any[] | undefined;
let mockDocuments: any[] | undefined;
const mockQueueBatchAnalysis = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (fnRef: string) => {
    if (fnRef === "documentAnalysis:getBatchProgress") return mockProgress;
    if (fnRef === "documentAnalysis:getActivityLogs") return mockActivityLogs;
    if (fnRef === "documents:listByProgram") return mockDocuments;
    return undefined;
  },
  useAction: (fnRef: string) => {
    if (fnRef === "documentAnalysisActions:queueBatchAnalysis") return mockQueueBatchAnalysis;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    documentAnalysis: {
      getBatchProgress: "documentAnalysis:getBatchProgress",
      getActivityLogs: "documentAnalysis:getActivityLogs",
    },
    documents: {
      listByProgram: "documents:listByProgram",
    },
    documentAnalysisActions: {
      queueBatchAnalysis: "documentAnalysisActions:queueBatchAnalysis",
    },
  },
}));

const defaultProps = {
  programId: "prog-1",
  orgId: "org-1",
  targetPlatform: "salesforce_b2b" as const,
};

describe("AnalysisProgressPanel", () => {
  beforeEach(() => {
    mockProgress = [];
    mockActivityLogs = [];
    mockDocuments = [];
    mockQueueBatchAnalysis.mockReset();
    mockQueueBatchAnalysis.mockResolvedValue(undefined);
  });

  it("renders null when there are no tracked documents", () => {
    mockDocuments = [{ _id: "doc-1", fileName: "notes.md", analysisStatus: "none" }];
    const { container } = render(<AnalysisProgressPanel {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows summary counts and failed banner", () => {
    mockDocuments = [
      { _id: "doc-1", fileName: "reqs.pdf", analysisStatus: "complete" },
      { _id: "doc-2", fileName: "diagram.pdf", analysisStatus: "analyzing" },
      { _id: "doc-3", fileName: "risks.pdf", analysisStatus: "failed" },
    ];

    render(<AnalysisProgressPanel {...defaultProps} />);

    expect(screen.getByText("1 complete · 1 in progress · 1 failed")).toBeInTheDocument();
    expect(
      screen.getByText("2 analyzed, 1 failed. Retry failed documents to continue."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Failed (1)" })).toBeInTheDocument();
  });

  it("retries failed documents via queueBatchAnalysis with failed ids", async () => {
    mockDocuments = [
      { _id: "doc-ok", fileName: "complete.pdf", analysisStatus: "complete" },
      { _id: "doc-f1", fileName: "failed-1.pdf", analysisStatus: "failed" },
      { _id: "doc-f2", fileName: "failed-2.pdf", analysisStatus: "failed" },
    ];

    render(<AnalysisProgressPanel {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry Failed (2)" }));

    await waitFor(() => {
      expect(mockQueueBatchAnalysis).toHaveBeenCalledWith({
        orgId: "org-1",
        programId: "prog-1",
        documentIds: ["doc-f1", "doc-f2"],
        targetPlatform: "salesforce_b2b",
      });
    });
  });
});
