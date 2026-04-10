import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./NotificationBell";

const mockPush = vi.fn();

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(() => ({ isAuthenticated: true })),
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("NotificationBell", () => {
  it("renders notification button", () => {
    render(<NotificationBell />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("shows dropdown when clicked", async () => {
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Mark all read")).toBeInTheDocument();
  });

  it("shows unread count badge", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockImplementation((fn: string) => {
      if (fn === "notifications:listUnread") return 5;
      return [];
    });

    render(<NotificationBell />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows 99+ for large counts", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockImplementation((fn: string) => {
      if (fn === "notifications:listUnread") return 150;
      return [];
    });

    render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    const { useQuery } = await import("convex/react");
    (useQuery as ReturnType<typeof vi.fn>).mockImplementation((fn: string) => {
      if (fn === "notifications:listUnread") return 0;
      return [];
    });

    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
  });

  it("closes dropdown on Escape key", async () => {
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Mark all read")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
  });
});
