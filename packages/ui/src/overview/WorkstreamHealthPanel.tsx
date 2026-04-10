"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { HealthScoreCard } from "../mission-control/HealthScoreCard";
import { useProgramContext } from "../programs/ProgramContext";

interface WorkstreamHealthPanelProps {
  workstreamId: string;
  workstreamName: string;
  open: boolean;
  onClose: () => void;
}

export function WorkstreamHealthPanel({
  workstreamId,
  workstreamName,
  open,
  onClose,
}: WorkstreamHealthPanelProps) {
  const { slug } = useProgramContext();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    // Delay to avoid the opening click triggering close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 transition-opacity" />
      <div
        ref={panelRef}
        className="relative w-full max-w-md animate-slide-in-right border-l border-border-default bg-surface-page shadow-xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
            <h2 className="text-sm font-semibold text-text-heading">Workstream Health</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-primary"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <HealthScoreCard workstreamId={workstreamId} workstreamName={workstreamName} />
          </div>

          <div className="border-t border-border-default px-5 py-3">
            <Link
              href={`/${slug}/workstreams/${workstreamId}`}
              className="btn-primary btn-sm w-full text-center"
              onClick={onClose}
            >
              View Full Workstream
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
