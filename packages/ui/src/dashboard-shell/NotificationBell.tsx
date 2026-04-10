"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";

interface AppNotification {
  _id: string;
  title: string;
  body?: string;
  link?: string;
  read?: boolean;
  createdAt?: number;
}

function parseUnreadCount(rawUnread: unknown) {
  if (typeof rawUnread === "number") return rawUnread;
  if (Array.isArray(rawUnread)) return rawUnread.length;

  if (rawUnread && typeof rawUnread === "object") {
    const maybeCount = (rawUnread as Record<string, unknown>).count;
    if (typeof maybeCount === "number") return maybeCount;
  }

  return 0;
}

function parseNotifications(rawRecent: unknown): AppNotification[] {
  if (Array.isArray(rawRecent)) return rawRecent as AppNotification[];

  if (rawRecent && typeof rawRecent === "object") {
    const maybeItems = (rawRecent as Record<string, unknown>).items;
    if (Array.isArray(maybeItems)) return maybeItems as AppNotification[];
  }

  return [];
}

function formatRelativeTime(timestamp?: number) {
  if (!timestamp) return "";

  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NotificationBell() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useConvexAuth();

  const rawUnread = useQuery(
    "notifications:listUnread" as any,
    isAuthenticated ? undefined : "skip",
  );
  const rawRecent = useQuery(
    "notifications:listRecent" as any,
    isAuthenticated ? undefined : "skip",
  );

  const markRead = useMutation("notifications:markRead" as any) as (args: {
    notificationId: string;
  }) => Promise<unknown>;

  const markAllRead = useMutation("notifications:markAllRead" as any) as (
    args: Record<string, never>,
  ) => Promise<unknown>;

  const [isOpen, setIsOpen] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const unreadCount = useMemo(() => parseUnreadCount(rawUnread), [rawUnread]);
  const notifications = useMemo(() => parseNotifications(rawRecent), [rawRecent]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleNotificationClick(notification: AppNotification) {
    if (!isAuthenticated) {
      return;
    }

    if (!notification.read) {
      try {
        await markRead({ notificationId: notification._id });
      } catch {
        // Keep navigation flow resilient if markRead fails.
      }
    }

    if (notification.link) {
      router.push(notification.link);
    }

    setIsOpen(false);
  }

  async function handleMarkRead(event: ReactMouseEvent<HTMLButtonElement>, notificationId: string) {
    event.stopPropagation();
    if (!isAuthenticated) {
      return;
    }
    await markRead({ notificationId });
  }

  async function handleMarkAllRead() {
    if (!isAuthenticated) {
      return;
    }

    setIsMarkingAll(true);

    try {
      await markAllRead({});
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-status-error-fg px-1.5 text-center text-[10px] font-semibold leading-5 text-text-on-brand">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border border-border-default bg-surface-raised shadow-2xl">
          <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={!isAuthenticated || isMarkingAll || unreadCount === 0}
              className="text-xs font-medium text-accent-default transition-colors hover:text-accent-strong disabled:opacity-50"
            >
              {isMarkingAll ? "Marking..." : "Mark all read"}
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!isAuthenticated ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">
                Sign in to view notifications.
              </p>
            ) : rawRecent === undefined ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">
                Loading notifications...
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">No notifications yet.</p>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className="flex items-start gap-3 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-interactive-hover last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => void handleNotificationClick(notification)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          notification.read ? "bg-border-strong" : "bg-status-error-fg"
                        }`}
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {notification.title}
                        </span>
                        {notification.body ? (
                          <span className="mt-0.5 block text-xs text-text-muted">
                            {notification.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-text-muted">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>

                    {!notification.read ? (
                      <button
                        type="button"
                        onClick={(event) => void handleMarkRead(event, notification._id)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-accent-default hover:bg-interactive-hover"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
