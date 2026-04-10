import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credential: { _id: "cred-1", status: "active", googleEmail: "user@gmail.com" } as any,
  getAccessToken: vi.fn().mockResolvedValue("access-token-123"),
  importFromDrive: vi.fn().mockResolvedValue([]),
  checkBatchDuplicates: vi.fn().mockResolvedValue([]),
  openPicker: vi.fn(),
  startImport: vi.fn().mockResolvedValue(undefined),
  removeImport: vi.fn(),
  imports: [] as any[],
  completedDocumentIds: [] as string[],
  isImporting: false,
  pickerState: "ready" as string,
  sdkError: null as string | null,
  pickerCallbacks: { onFilesSelected: null as ((files: any[]) => Promise<void>) | null },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn((_name: string, args: any) => {
    if (args === "skip") return undefined;
    return mocks.credential;
  }),
  useAction: vi.fn((name: string) => {
    if (name === "googleDrive/credentials:getAccessTokenForPicker") return mocks.getAccessToken;
    if (name === "googleDrive/importActions:importDriveFiles") return mocks.importFromDrive;
    if (name === "googleDrive/credentials:checkBatchDuplicates") return mocks.checkBatchDuplicates;
    return vi.fn();
  }),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("./useGooglePicker", () => ({
  useGooglePicker: vi.fn(({ onFilesSelected }: { onFilesSelected: any }) => {
    mocks.pickerCallbacks.onFilesSelected = onFilesSelected;
    return {
      pickerState: mocks.pickerState,
      sdkError: mocks.sdkError,
      openPicker: mocks.openPicker,
    };
  }),
}));

vi.mock("./useDriveImportQueue", () => ({
  useDriveImportQueue: vi.fn(() => ({
    imports: mocks.imports,
    startImport: mocks.startImport,
    removeImport: mocks.removeImport,
    isImporting: mocks.isImporting,
    completedDocumentIds: mocks.completedDocumentIds,
    hasErrors: false,
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => mocks.toastError(...args),
    success: (...args: any[]) => mocks.toastSuccess(...args),
  },
}));

import { GoogleDriveImportButton } from "./GoogleDriveImportButton";

const defaultProps = {
  orgId: "org-1",
  programId: "prog-1",
};

describe("GoogleDriveImportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.credential = { _id: "cred-1", status: "active", googleEmail: "user@gmail.com" };
    mocks.pickerState = "ready";
    mocks.sdkError = null;
    mocks.imports = [];
    mocks.isImporting = false;
    mocks.completedDocumentIds = [];
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_API_KEY", "test-api-key");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "test-client-id");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders enabled button when credential is active", () => {
    render(<GoogleDriveImportButton {...defaultProps} />);
    const button = screen.getByRole("button", { name: /import from drive/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("is disabled when credential is null (no account connected)", () => {
    mocks.credential = null;
    render(<GoogleDriveImportButton {...defaultProps} />);
    expect(screen.getByRole("button", { name: /import from drive/i })).toBeDisabled();
  });

  it("is disabled when credential is expired", () => {
    mocks.credential = { _id: "cred-1", status: "expired", googleEmail: "user@gmail.com" };
    render(<GoogleDriveImportButton {...defaultProps} />);
    expect(screen.getByRole("button", { name: /import from drive/i })).toBeDisabled();
  });

  it("is disabled when SDK is still loading", () => {
    mocks.pickerState = "loading_sdk";
    render(<GoogleDriveImportButton {...defaultProps} />);
    // Button label changes to "Loading…" when SDK is loading
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("renders SDK error message instead of button", () => {
    mocks.sdkError = "Google Picker unavailable — use file upload instead";
    render(<GoogleDriveImportButton {...defaultProps} />);
    expect(
      screen.getByText("Google Picker unavailable — use file upload instead"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /import from drive/i })).not.toBeInTheDocument();
  });

  it("calls getAccessToken then openPicker on click", async () => {
    render(<GoogleDriveImportButton {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /import from drive/i }));
    await waitFor(() => {
      expect(mocks.getAccessToken).toHaveBeenCalledWith({
        orgId: "org-1",
        credentialId: "cred-1",
      });
      expect(mocks.openPicker).toHaveBeenCalledWith("access-token-123");
    });
  });

  it("shows expired token toast when getAccessToken fails with expired message", async () => {
    mocks.getAccessToken.mockRejectedValue(new Error("Token expired, please reconnect"));
    render(<GoogleDriveImportButton {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /import from drive/i }));
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining("re-authorization"));
    });
  });

  it("renders per-file import status items", () => {
    mocks.imports = [
      { id: "f1", name: "Report.pdf", status: "importing" },
      { id: "f2", name: "Spec.docx", status: "done" },
    ];
    render(<GoogleDriveImportButton {...defaultProps} />);
    expect(screen.getByText("Report.pdf")).toBeInTheDocument();
    expect(screen.getByText("Spec.docx")).toBeInTheDocument();
    expect(screen.getByText("Importing…")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows duplicate dialog when picker returns already-imported files", async () => {
    mocks.checkBatchDuplicates.mockResolvedValue([
      { driveFileId: "f1", fileName: "Report.pdf", importedAt: Date.now() },
    ]);
    render(<GoogleDriveImportButton {...defaultProps} />);

    await act(async () => {
      await mocks.pickerCallbacks.onFilesSelected?.([
        { id: "f1", name: "Report.pdf", mimeType: "application/pdf" },
      ]);
    });

    expect(screen.getByText("File already imported")).toBeInTheDocument();
    expect(screen.getByText("Import anyway")).toBeInTheDocument();
  });
});
