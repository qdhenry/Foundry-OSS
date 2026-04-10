import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockRefreshSnapshot = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
  useMutation: () => mockRefreshSnapshot,
}));

import { TaskDesignContextCard } from "./TaskDesignContextCard";

describe("TaskDesignContextCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when snapshot is loading (undefined)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { container } = render(<TaskDesignContextCard taskId="t1" programId="p1" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders empty state when snapshot is null", () => {
    mockUseQuery.mockReturnValue(null);
    render(<TaskDesignContextCard taskId="t1" programId="p1" />);
    expect(screen.getByText("No design context attached")).toBeInTheDocument();
    expect(screen.getByText("Sync Design Context")).toBeInTheDocument();
  });

  it("shows design page link using slug when provided", () => {
    mockUseQuery.mockReturnValue(null);
    render(<TaskDesignContextCard taskId="t1" programId="p1" programSlug="my-slug" />);
    const link = screen.getByText("Design page");
    expect(link).toHaveAttribute("href", "/my-slug/design");
  });

  it("shows design page link using programId when no slug", () => {
    mockUseQuery.mockReturnValue(null);
    render(<TaskDesignContextCard taskId="t1" programId="p1" />);
    const link = screen.getByText("Design page");
    expect(link).toHaveAttribute("href", "/p1/design");
  });

  it("renders populated snapshot with metadata", () => {
    mockUseQuery.mockReturnValue({
      snapshotVersion: 3,
      degraded: false,
      resolvedTokens: JSON.stringify({ colors: { primary: "#0000ff", secondary: "#ff0000" } }),
      resolvedComponents: JSON.stringify([{ name: "Button" }, { name: "Input" }]),
      assetIds: ["a1", "a2", "a3"],
      tokenSetId: "ts1",
      createdAt: Date.now(),
    });
    render(<TaskDesignContextCard taskId="t1" programId="p1" />);
    expect(screen.getByText("Design Context")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("3 assets")).toBeInTheDocument();
    expect(screen.getByText("Token set")).toBeInTheDocument();
    expect(screen.getByText("2 components")).toBeInTheDocument();
  });

  it("shows degraded warning when snapshot is degraded", () => {
    mockUseQuery.mockReturnValue({
      snapshotVersion: 1,
      degraded: true,
      resolvedTokens: "{}",
      resolvedComponents: "[]",
      assetIds: [],
      createdAt: Date.now(),
    });
    render(<TaskDesignContextCard taskId="t1" programId="p1" />);
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("toggles collapse on header click", () => {
    mockUseQuery.mockReturnValue({
      snapshotVersion: 1,
      degraded: false,
      resolvedTokens: "{}",
      resolvedComponents: "[]",
      assetIds: [],
      createdAt: Date.now(),
    });
    render(<TaskDesignContextCard taskId="t1" programId="p1" />);
    expect(screen.getByText("Refresh")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Design Context"));
    expect(screen.queryByText("Refresh")).not.toBeInTheDocument();
  });

  it("calls refresh mutation on sync button click", async () => {
    mockUseQuery.mockReturnValue(null);
    render(<TaskDesignContextCard taskId="t1" programId="p1" />);
    fireEvent.click(screen.getByText("Sync Design Context"));
    expect(mockRefreshSnapshot).toHaveBeenCalledWith({ taskId: "t1" });
  });
});
