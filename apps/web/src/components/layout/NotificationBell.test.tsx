import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./NotificationBell";

const mockPush = vi.fn();
let mockUnread: any;
let mockRecent: any;
const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("convex/react", () => ({
  useQuery: (fnRef: string) => {
    if (fnRef === "notifications:listUnread") return mockUnread;
    if (fnRef === "notifications:listRecent") return mockRecent;
    return undefined;
  },
  useMutation: (fnRef: string) => {
    if (fnRef === "notifications:markRead") return mockMarkRead;
    if (fnRef === "notifications:markAllRead") return mockMarkAllRead;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    notifications: {
      listUnread: "notifications:listUnread",
      listRecent: "notifications:listRecent",
      markRead: "notifications:markRead",
      markAllRead: "notifications:markAllRead",
    },
  },
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    mockUnread = [
      { _id: "n-1", read: false },
      { _id: "n-2", read: false },
    ];
    mockRecent = [
      {
        _id: "n-1",
        title: "Agent finished: Checkout taxes",
        body: "PR #42 created.",
        link: "/prog-1/tasks/task-1",
        read: false,
        createdAt: Date.now() - 60_000,
      },
      {
        _id: "n-2",
        title: "Agent failed: Promo pricing",
        body: "Build failed",
        link: "/prog-1/tasks/task-2",
        read: true,
        createdAt: Date.now() - 120_000,
      },
    ];
    mockPush.mockReset();
    mockMarkRead.mockReset();
    mockMarkAllRead.mockReset();
    mockMarkRead.mockResolvedValue(undefined);
    mockMarkAllRead.mockResolvedValue(undefined);
  });

  it("shows unread count and navigates when notification is clicked", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    expect(screen.getByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Agent finished: Checkout taxes")).toBeInTheDocument();

    await user.click(screen.getByText("Agent finished: Checkout taxes"));

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith({ notificationId: "n-1" });
    });
    expect(mockPush).toHaveBeenCalledWith("/prog-1/tasks/task-1");
  });

  it("marks one or all notifications as read from dropdown actions", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    await user.click(screen.getByRole("button", { name: "Notifications" }));
    await user.click(screen.getByRole("button", { name: "Mark read" }));
    expect(mockMarkRead).toHaveBeenCalledWith({ notificationId: "n-1" });

    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(mockMarkAllRead).toHaveBeenCalledWith({});
  });
});
