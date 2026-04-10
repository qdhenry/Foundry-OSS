"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface ActivityFeedProps {
  programId: string;
  initialPageSize?: number;
}

export function ActivityFeed({ programId, initialPageSize = 20 }: ActivityFeedProps) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.activityEvents.listRecent,
    {
      programId,
    },
    {
      initialNumItems: initialPageSize,
    },
  );

  if (status === "LoadingFirstPage") {
    return (
      <div className="card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary">Activity</h3>
        <p className="mt-2 text-xs text-text-muted">Loading activity…</p>
      </div>
    );
  }

  if (results.length === 0) return null;

  return (
    <div className="card rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text-primary">Activity</h3>
      <div className="mt-3 space-y-2">
        {results.map((item: any) => (
          <div key={item._id} className="flex items-start justify-between gap-3 text-xs">
            <div>
              <p className="text-text-primary">{item.message}</p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {item.userName} · {item.eventType}
              </p>
            </div>
            <span className="shrink-0 text-text-muted">
              {new Date(item.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
      {status === "CanLoadMore" && (
        <button
          type="button"
          onClick={() => loadMore(initialPageSize)}
          className="mt-3 btn-secondary btn-sm"
        >
          Load more
        </button>
      )}
    </div>
  );
}
