import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Controllable mock functions ---
const mockQueueBatchAnalysis = vi.fn().mockResolvedValue(undefined);
const mockCreateProgram = vi.fn().mockResolvedValue("program-id-123");
const mockUpdateSetupStatus = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useAction: () => mockQueueBatchAnalysis,
  useMutation: (ref: unknown) => {
    // Distinguish mutations by the reference object identity.
    // In practice the ref is api.programs.create or api.programs.updateSetupStatus.
    // Since we mock the api module, we use a string marker approach.
    const name = ref && typeof ref === "object" && "$$name" in ref ? (ref as any).$$name : "";
    if (name === "programs:updateSetupStatus") return mockUpdateSetupStatus;
    return mockCreateProgram;
  },
  useQuery: () => undefined,
}));

// Mock the Convex API references with identifying markers
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    programs: {
      create: { $$name: "programs:create" },
      updateSetupStatus: { $$name: "programs:updateSetupStatus" },
      get: { $$name: "programs:get" },
    },
    documentAnalysisActions: {
      queueBatchAnalysis: { $$name: "documentAnalysisActions:queueBatchAnalysis" },
    },
  },
}));

// Mock @clerk/nextjs
vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: "org-1" } }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock slugify
vi.mock("../../../convex/model/slugify", () => ({
  slugify: (name: string) => name.toLowerCase().replace(/\s+/g, "-"),
}));

// --- Child component mocks that capture callbacks ---

let capturedBasicsOnNext: (() => Promise<void>) | null = null;
let capturedBasicsOnChange: ((data: any) => void) | null = null;
let capturedUploadOnNext:
  | ((result: {
      documentIdsToQueue: string[];
      alreadyQueuedDocumentIds: string[];
    }) => Promise<void>)
  | null = null;

vi.mock("./wizard/WizardStepIndicator", () => ({
  WizardStepIndicator: ({ steps, currentStep }: { steps: string[]; currentStep: number }) => (
    <div data-testid="step-indicator" data-step={currentStep}>
      {steps.map((s: string, i: number) => (
        <span key={i}>{s}</span>
      ))}
    </div>
  ),
}));

vi.mock("./wizard/ProgramBasicsForm", () => ({
  ProgramBasicsForm: ({
    onNext,
    onChange,
  }: {
    onNext: () => Promise<void>;
    onChange: (d: any) => void;
  }) => {
    capturedBasicsOnNext = onNext;
    capturedBasicsOnChange = onChange;
    return <div data-testid="program-basics-form">ProgramBasicsForm</div>;
  },
}));

vi.mock("./wizard/DocumentUploadStep", () => ({
  DocumentUploadStep: ({
    onNext,
    programId,
    orgId,
  }: {
    onNext: (result: {
      documentIdsToQueue: string[];
      alreadyQueuedDocumentIds: string[];
    }) => Promise<void>;
    programId: string | null;
    orgId: string;
  }) => {
    capturedUploadOnNext = onNext;
    return (
      <div data-testid="document-upload-step" data-program-id={programId} data-org-id={orgId}>
        DocumentUploadStep
      </div>
    );
  },
}));

vi.mock("./wizard/AnalysisStep", () => ({
  AnalysisStep: () => <div data-testid="analysis-step">AnalysisStep</div>,
}));

vi.mock("./wizard/ReviewStep", () => ({
  ReviewStep: () => <div data-testid="review-step">ReviewStep</div>,
}));

vi.mock("./wizard/LaunchStep", () => ({
  LaunchStep: () => <div data-testid="launch-step">LaunchStep</div>,
}));

import { ProgramWizard } from "./ProgramWizard";

/**
 * Helper: advance wizard from step 0 to step 1 by simulating ProgramBasicsForm's onNext.
 * Sets basicsData with valid engagement type first, then triggers handleBasicsNext.
 */
async function advanceToUploadStep() {
  render(<ProgramWizard />);

  // Set basicsData with valid values via onChange
  if (capturedBasicsOnChange) {
    act(() => {
      capturedBasicsOnChange?.({
        name: "Test Program",
        clientName: "Test Client",
        engagementType: "greenfield",
        techStack: [],
        description: "",
        startDate: "",
        targetEndDate: "",
        workstreams: [{ name: "Dev", shortCode: "DEV", sortOrder: 0 }],
      });
    });
  }

  // Trigger handleBasicsNext (creates program, advances to step 1)
  await act(async () => {
    await capturedBasicsOnNext?.();
  });

  // Verify we're now on step 1 with DocumentUploadStep visible
  await waitFor(() => {
    expect(screen.getByTestId("document-upload-step")).toBeInTheDocument();
  });
}

describe("ProgramWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedBasicsOnNext = null;
    capturedBasicsOnChange = null;
    capturedUploadOnNext = null;
    mockCreateProgram.mockResolvedValue("program-id-123");
    mockQueueBatchAnalysis.mockResolvedValue(undefined);
  });

  // ---- Basic rendering ----

  it('renders with title "Launch a New Program"', () => {
    render(<ProgramWizard />);
    expect(screen.getByText("Launch a New Program")).toBeInTheDocument();
  });

  it('renders subtitle "Define your engagement and start delivering."', () => {
    render(<ProgramWizard />);
    expect(screen.getByText("Define your engagement and start delivering.")).toBeInTheDocument();
  });

  it("renders all 5 step labels", () => {
    render(<ProgramWizard />);
    expect(screen.getByText("Program Setup")).toBeInTheDocument();
    expect(screen.getByText("Upload Documents")).toBeInTheDocument();
    expect(screen.getByText("Analysis")).toBeInTheDocument();
    expect(screen.getByText("Review Findings")).toBeInTheDocument();
    expect(screen.getByText("Launch")).toBeInTheDocument();
  });

  it("starts on step 0 with ProgramBasicsForm visible", () => {
    render(<ProgramWizard />);
    expect(screen.getByTestId("step-indicator")).toHaveAttribute("data-step", "0");
    expect(screen.getByTestId("program-basics-form")).toBeInTheDocument();
  });

  it("shows loading spinner when resumeProgramId provided but data not loaded", () => {
    render(<ProgramWizard resumeProgramId="some-program-id" />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen.queryByText("Launch a New Program")).not.toBeInTheDocument();
  });

  it("only renders step 0 initially, no other steps", () => {
    render(<ProgramWizard />);
    expect(screen.getByTestId("program-basics-form")).toBeInTheDocument();
    expect(screen.queryByTestId("document-upload-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("analysis-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("review-step")).not.toBeInTheDocument();
    expect(screen.queryByTestId("launch-step")).not.toBeInTheDocument();
  });

  // ---- Step 0 → 1: handleBasicsNext ----

  describe("handleBasicsNext", () => {
    it("calls createProgram and advances to step 1", async () => {
      await advanceToUploadStep();

      expect(mockCreateProgram).toHaveBeenCalledOnce();
      expect(screen.getByTestId("document-upload-step")).toBeInTheDocument();
      expect(screen.queryByTestId("program-basics-form")).not.toBeInTheDocument();
    });

    it("passes programId to DocumentUploadStep after creation", async () => {
      await advanceToUploadStep();

      const uploadStep = screen.getByTestId("document-upload-step");
      expect(uploadStep).toHaveAttribute("data-program-id", "program-id-123");
      expect(uploadStep).toHaveAttribute("data-org-id", "org-1");
    });
  });

  // ---- Step 1 → 2: handleUploadStepNext (REGRESSION TESTS) ----

  describe("handleUploadStepNext (document analysis regression)", () => {
    it("calls queueBatchAnalysis with correct args including targetPlatform: 'none'", async () => {
      await advanceToUploadStep();

      // Invoke the onNext callback with document IDs
      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: ["doc-1", "doc-2", "doc-3"],
          alreadyQueuedDocumentIds: [],
        });
      });

      expect(mockQueueBatchAnalysis).toHaveBeenCalledOnce();
      expect(mockQueueBatchAnalysis).toHaveBeenCalledWith({
        orgId: "org-1",
        programId: "program-id-123",
        documentIds: ["doc-1", "doc-2", "doc-3"],
        targetPlatform: "none",
      });
    });

    it("does NOT pass engagementType to queueBatchAnalysis", async () => {
      await advanceToUploadStep();

      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: ["doc-1"],
          alreadyQueuedDocumentIds: [],
        });
      });

      const callArgs = mockQueueBatchAnalysis.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("engagementType");
    });

    it("forwards all document IDs to queueBatchAnalysis", async () => {
      await advanceToUploadStep();

      const docIds = ["doc-a", "doc-b", "doc-c", "doc-d"];
      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: docIds,
          alreadyQueuedDocumentIds: [],
        });
      });

      const callArgs = mockQueueBatchAnalysis.mock.calls[0][0];
      expect(callArgs.documentIds).toEqual(docIds);
    });

    it("advances to step 2 (Analysis) after successful queueBatchAnalysis", async () => {
      await advanceToUploadStep();

      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: ["doc-1"],
          alreadyQueuedDocumentIds: [],
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId("analysis-step")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("document-upload-step")).not.toBeInTheDocument();
    });

    it("calls updateSetupStatus with 'analyzing' after queuing analysis", async () => {
      await advanceToUploadStep();

      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: ["doc-1"],
          alreadyQueuedDocumentIds: [],
        });
      });

      expect(mockUpdateSetupStatus).toHaveBeenCalledWith({
        programId: "program-id-123",
        setupStatus: "analyzing",
      });
    });

    it("advances to step 2 even when queueBatchAnalysis fails", async () => {
      mockQueueBatchAnalysis.mockRejectedValueOnce(new Error("Network error"));

      await advanceToUploadStep();

      // Should not throw, and should still advance
      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: ["doc-1"],
          alreadyQueuedDocumentIds: [],
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId("analysis-step")).toBeInTheDocument();
      });
    });

    it("still calls updateSetupStatus when queueBatchAnalysis fails", async () => {
      mockQueueBatchAnalysis.mockRejectedValueOnce(new Error("API error"));

      await advanceToUploadStep();

      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: ["doc-1"],
          alreadyQueuedDocumentIds: [],
        });
      });

      // updateSetupStatus should still be called in the catch block
      expect(mockUpdateSetupStatus).toHaveBeenCalledWith({
        programId: "program-id-123",
        setupStatus: "analyzing",
      });
    });

    it("skips queueBatchAnalysis and advances when documentIds is empty", async () => {
      await advanceToUploadStep();

      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: [],
          alreadyQueuedDocumentIds: [],
        });
      });

      // Should NOT call queueBatchAnalysis with empty docs
      expect(mockQueueBatchAnalysis).not.toHaveBeenCalled();

      // Should still advance to step 2
      await waitFor(() => {
        expect(screen.getByTestId("analysis-step")).toBeInTheDocument();
      });
    });

    it("uses targetPlatform 'none' as default for new programs (no existingProgram)", async () => {
      // This is the core regression test: new programs have no existingProgram,
      // so (existingProgram as any)?.targetPlatform is undefined.
      // The fix ensures ?? "none" is applied.
      await advanceToUploadStep();

      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: ["doc-1"],
          alreadyQueuedDocumentIds: [],
        });
      });

      const callArgs = mockQueueBatchAnalysis.mock.calls[0][0];
      expect(callArgs.targetPlatform).toBe("none");
      expect(callArgs.targetPlatform).not.toBeUndefined();
    });

    it("skips re-queueing analysis but marks setup as analyzing for Drive-only imports", async () => {
      await advanceToUploadStep();

      await act(async () => {
        await capturedUploadOnNext?.({
          documentIdsToQueue: [],
          alreadyQueuedDocumentIds: ["drive-doc-1"],
        });
      });

      expect(mockQueueBatchAnalysis).not.toHaveBeenCalled();
      expect(mockUpdateSetupStatus).toHaveBeenCalledWith({
        programId: "program-id-123",
        setupStatus: "analyzing",
      });
      await waitFor(() => {
        expect(screen.getByTestId("analysis-step")).toBeInTheDocument();
      });
    });
  });
});
