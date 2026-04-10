"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const ORCHESTRATION_TYPES = new Set([
  "orchestration_plan_ready",
  "orchestration_complete",
  "orchestration_failed",
]);

export function useOrchestrationNotifications() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();
  const notifications = useQuery("notifications:listUnread" as any, isAuthenticated ? {} : "skip");
  const markRead = useMutation("notifications:markRead" as any);
  const shownIds = useRef(new Set<string>());

  useEffect(() => {
    if (!notifications) return;

    for (const notif of notifications) {
      if (!ORCHESTRATION_TYPES.has(notif.type) || shownIds.current.has(notif._id)) continue;
      shownIds.current.add(notif._id);

      const method =
        notif.type === "orchestration_failed"
          ? "error"
          : notif.type === "orchestration_complete"
            ? "success"
            : "info";

      toast[method](notif.title, {
        description: notif.body,
        duration: 10000,
        action: notif.link
          ? {
              label: "View",
              onClick: () => {
                markRead({ notificationId: notif._id });
                router.push(notif.link);
              },
            }
          : undefined,
      });
    }
  }, [notifications, router, markRead]);
}
