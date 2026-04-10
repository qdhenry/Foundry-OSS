"use client";

import { User01 } from "@untitledui/icons";
import { useMutation, useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useProgramContext } from "@/lib/programContext";

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function labelFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const page = segments[1] ?? "overview";
  return page
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type PresenceEntry = {
  _id: string;
  userName?: string | null;
  userAvatarUrl?: string | null;
};

type PresenceMember = {
  key: string;
  name: string;
};

export function PresenceBar() {
  const pathname = usePathname();
  const programCtx = (
    useProgramContext as unknown as () => {
      programId?: string;
    }
  )();

  const programId = programCtx?.programId;
  const pageKey = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return segments[1] ?? "overview";
  }, [pathname]);

  const upsertPresence = useMutation("presence:upsert" as any);
  const livePresence = useQuery(
    "presence:listByPage" as any,
    programId
      ? {
          programId: programId!,
          page: pageKey,
        }
      : "skip",
  );

  useEffect(() => {
    if (!programId) return;
    let intervalId: number | null = null;
    let cancelled = false;

    async function heartbeat() {
      if (document.visibilityState !== "visible") return;
      if (cancelled) return;
      try {
        await upsertPresence({
          programId: programId!,
          page: pageKey,
        });
      } catch {
        // Presence is non-blocking UX; ignore heartbeat failures.
      }
    }

    void heartbeat();
    intervalId = window.setInterval(() => {
      void heartbeat();
    }, 20_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [pageKey, programId, upsertPresence]);

  const members = useMemo<PresenceMember[]>(() => {
    if (!livePresence) return [];
    return livePresence.slice(0, 8).map((entry: PresenceEntry) => ({
      key: entry._id,
      name: entry.userName ?? "Unknown",
    }));
  }, [livePresence]);

  if (!programId) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 card rounded-xl px-4 py-2.5">
      <div>
        <p className="text-xs font-medium text-text-secondary">Collaboration</p>
        <p className="text-xs text-text-muted">Viewing: {labelFromPath(pathname)}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {livePresence === undefined ? (
          <span className="text-xs text-text-muted">Loading...</span>
        ) : members.length === 0 ? (
          <span className="text-xs text-text-muted">No collaborators yet</span>
        ) : (
          members.map((member) => (
            <div key={member.key} className="group relative">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border-default bg-surface-raised text-[11px] font-semibold text-text-primary">
                {member.name && member.name !== "Unknown" ? (
                  initialsFromName(member.name)
                ) : (
                  <User01 size={16} className="text-text-muted" />
                )}
              </div>
              <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden whitespace-nowrap rounded bg-comp-tooltip-bg border border-comp-tooltip-border px-2 py-1 text-[10px] text-comp-tooltip-text shadow-md group-hover:block">
                {member.name}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
