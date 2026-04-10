import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credentials: undefined as any,
  revokeCredential: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn((_name: string, args: any) => {
    if (args === "skip") return undefined;
    return mocks.credentials;
  }),
  useMutation: vi.fn(() => mocks.revokeCredential),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => mocks.toastError(...args),
    success: (...args: any[]) => mocks.toastSuccess(...args),
  },
}));

import { GoogleDriveConnectionList } from "./GoogleDriveConnectionList";

const activeCredential = {
  _id: "cred-1",
  googleEmail: "alice@gmail.com",
  status: "active" as const,
  connectedAt: Date.now() - 86400000,
  lastUsedAt: Date.now() - 3600000,
  connectedByUserName: "Alice Smith",
};

const expiredCredential = {
  _id: "cred-2",
  googleEmail: "bob@gmail.com",
  status: "expired" as const,
  connectedAt: Date.now() - 7 * 86400000,
  lastUsedAt: Date.now() - 2 * 86400000,
};

describe("GoogleDriveConnectionList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.revokeCredential.mockResolvedValue(undefined);
  });

  it("shows loading skeletons when credentials are undefined", () => {
    mocks.credentials = undefined;
    const { container } = render(<GoogleDriveConnectionList orgId="org-1" />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no credentials exist", () => {
    mocks.credentials = [];
    render(<GoogleDriveConnectionList orgId="org-1" />);
    expect(screen.getByText("No Google Drive connections yet.")).toBeInTheDocument();
  });

  it("renders credential table with email and connected-by columns", () => {
    mocks.credentials = [activeCredential];
    render(<GoogleDriveConnectionList orgId="org-1" />);
    expect(screen.getByText("alice@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("shows Active badge for active credentials", () => {
    mocks.credentials = [activeCredential];
    render(<GoogleDriveConnectionList orgId="org-1" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows Expired badge for expired credentials", () => {
    mocks.credentials = [expiredCredential];
    render(<GoogleDriveConnectionList orgId="org-1" />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("opens disconnect dialog when Disconnect button is clicked", () => {
    mocks.credentials = [activeCredential];
    render(<GoogleDriveConnectionList orgId="org-1" />);
    fireEvent.click(screen.getByText("Disconnect"));
    expect(screen.getByText("Disconnect Google Drive")).toBeInTheDocument();
    expect(screen.getByText(/revoke Foundry's access to/)).toBeInTheDocument();
  });

  it("calls revokeCredential and shows success toast on confirm", async () => {
    mocks.credentials = [activeCredential];
    render(<GoogleDriveConnectionList orgId="org-1" />);

    fireEvent.click(screen.getByText("Disconnect"));
    // ConfirmDialog renders with "Disconnect" confirm button
    const confirmButtons = screen.getAllByText("Disconnect");
    // The dialog's confirm button is the last one rendered
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mocks.revokeCredential).toHaveBeenCalledWith({ credentialId: "cred-1" });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Disconnected alice@gmail.com");
    });
  });
});
