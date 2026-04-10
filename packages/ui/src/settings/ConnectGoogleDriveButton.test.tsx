import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  startOAuth: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => mocks.startOAuth),
  useQuery: vi.fn(() => undefined),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => mocks.toastError(...args),
    success: (...args: any[]) => mocks.toastSuccess(...args),
  },
}));

import { ConnectGoogleDriveButton } from "./ConnectGoogleDriveButton";

describe("ConnectGoogleDriveButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.startOAuth.mockResolvedValue({ authorizationUrl: "https://accounts.google.com/auth" });
  });

  it("renders Connect Google Drive button", () => {
    render(<ConnectGoogleDriveButton orgId="org-1" />);
    expect(screen.getByText("Connect Google Drive")).toBeInTheDocument();
  });

  it("calls startOAuth with orgId when clicked", async () => {
    render(<ConnectGoogleDriveButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Connect Google Drive"));
    await waitFor(() => {
      expect(mocks.startOAuth).toHaveBeenCalledWith({ orgId: "org-1" });
    });
  });

  it("sets gdrive_return_url cookie before redirecting", async () => {
    render(<ConnectGoogleDriveButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Connect Google Drive"));
    await waitFor(() => {
      expect(document.cookie).toContain("gdrive_return_url");
    });
  });

  it("shows Redirecting... label while waiting for OAuth URL", () => {
    let resolveOAuth: (v: any) => void;
    mocks.startOAuth.mockReturnValue(
      new Promise((resolve) => {
        resolveOAuth = resolve;
      }),
    );
    render(<ConnectGoogleDriveButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Connect Google Drive"));
    expect(screen.getByText("Redirecting...")).toBeInTheDocument();
    // Resolve to avoid hanging
    act(() => resolveOAuth?.({ authorizationUrl: "https://example.com" }));
  });

  it("shows error toast when startOAuth throws", async () => {
    mocks.startOAuth.mockRejectedValue(new Error("OAuth configuration missing"));
    render(<ConnectGoogleDriveButton orgId="org-1" />);
    fireEvent.click(screen.getByText("Connect Google Drive"));
    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("OAuth configuration missing");
    });
  });
});
