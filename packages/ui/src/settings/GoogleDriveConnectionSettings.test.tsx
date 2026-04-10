import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credentials: null as any,
  orgId: "org-1",
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mocks.credentials),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}));

vi.mock("@clerk/nextjs", () => ({
  useOrganization: () => ({ organization: { id: mocks.orgId } }),
}));

// Mock child components so their own deps don't need to be satisfied
vi.mock("./ConnectGoogleDriveButton", () => ({
  ConnectGoogleDriveButton: ({ orgId }: { orgId: string }) => (
    <button data-testid="connect-button" data-org-id={orgId}>
      Connect Google Drive
    </button>
  ),
}));

vi.mock("./GoogleDriveConnectionList", () => ({
  GoogleDriveConnectionList: ({ orgId }: { orgId: string }) => (
    <div data-testid="connection-list" data-org-id={orgId} />
  ),
}));

import { GoogleDriveConnectionSettings } from "./GoogleDriveConnectionSettings";

describe("GoogleDriveConnectionSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.credentials = null;
    mocks.orgId = "org-1";
  });

  it("renders Google Drive heading", () => {
    render(<GoogleDriveConnectionSettings />);
    expect(screen.getByText("Google Drive")).toBeInTheDocument();
  });

  it("shows active connection count badge when credentials exist", () => {
    mocks.credentials = [
      { _id: "c1", status: "active" },
      { _id: "c2", status: "expired" },
    ];
    render(<GoogleDriveConnectionSettings />);
    expect(screen.getByText("1 connected")).toBeInTheDocument();
  });

  it("renders the ConnectGoogleDriveButton with orgId", () => {
    render(<GoogleDriveConnectionSettings />);
    expect(screen.getByTestId("connect-button")).toBeInTheDocument();
    expect(screen.getByTestId("connect-button")).toHaveAttribute("data-org-id", "org-1");
  });

  it("renders GoogleDriveConnectionList with orgId", () => {
    render(<GoogleDriveConnectionSettings />);
    expect(screen.getByTestId("connection-list")).toBeInTheDocument();
    expect(screen.getByTestId("connection-list")).toHaveAttribute("data-org-id", "org-1");
  });
});
