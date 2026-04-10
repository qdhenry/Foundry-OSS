"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useRef } from "react";
import { useStaggerEntrance } from "../theme/useAnimations";

type WorkstreamStatus = "on_track" | "at_risk" | "blocked";

type WorkstreamListItem = {
  _id: string;
  name: string;
  shortCode: string;
  status: string;
  currentSprint?: number;
  sprintCadence?: number;
};

type RequirementListItem = {
  workstreamId?: string | null;
};

type TaskListItem = {
  workstreamId?: string | null;
  status?: string;
};

export interface WorkstreamsPageProps {
  programId: string;
  programSlug: string;
}

const RAG_CONFIG: Record<string, { color: string; label: string }> = {
  on_track: { color: "bg-status-success-fg", label: "On Track" },
  at_risk: { color: "bg-status-warning-fg", label: "At Risk" },
  blocked: { color: "bg-status-error-fg", label: "Blocked" },
};

const STATUS_CYCLE: WorkstreamStatus[] = ["on_track", "at_risk", "blocked"];

export function WorkstreamsPage({ programId, programSlug }: WorkstreamsPageProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(gridRef, ".animate-card");

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as WorkstreamListItem[] | undefined;
  const allRequirements = useQuery(
    "requirements:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as RequirementListItem[] | undefined;
  const allTasks = useQuery("tasks:listByProgram" as any, programId ? { programId } : "skip") as
    | TaskListItem[]
    | undefined;
  const updateWorkstream = useMutation("workstreams:update" as any);

  const statsMap = useMemo(() => {
    const map: Record<string, { reqCount: number; taskTotal: number; taskDone: number }> = {};
    if (!allRequirements || !allTasks) return map;

    for (const req of allRequirements) {
      const wsId = req.workstreamId;
      if (!wsId) continue;
      if (!map[wsId]) map[wsId] = { reqCount: 0, taskTotal: 0, taskDone: 0 };
      map[wsId].reqCount++;
    }

    for (const task of allTasks) {
      const wsId = task.workstreamId;
      if (!wsId) continue;
      if (!map[wsId]) map[wsId] = { reqCount: 0, taskTotal: 0, taskDone: 0 };
      map[wsId].taskTotal++;
      if (task.status === "done") map[wsId].taskDone++;
    }

    return map;
  }, [allRequirements, allTasks]);

  const cycleStatus = (workstreamId: string, currentStatus: string) => {
    const currentIdx = STATUS_CYCLE.indexOf(currentStatus as WorkstreamStatus);
    const nextStatus = STATUS_CYCLE[(currentIdx + 1) % STATUS_CYCLE.length];
    void updateWorkstream({ workstreamId, status: nextStatus });
  };

  if (workstreams === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="type-display-m text-text-heading">Workstreams</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Delivery tracks for this migration program
        </p>
      </div>

      {workstreams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-default py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-interactive-subtle">
            <svg
              className="h-8 w-8 text-accent-default"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary">No workstreams yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Workstreams are created automatically when a program is set up. Import requirements
            first to organize them into delivery tracks.
          </p>
          <Link
            href={`/${programSlug}/requirements`}
            className="btn-primary btn-sm mt-4 inline-flex items-center gap-2"
          >
            Create requirements first
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      ) : (
        <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workstreams.map((ws) => {
            const rag = RAG_CONFIG[ws.status];
            const stats = statsMap[ws._id];
            return (
              <Link
                key={ws._id}
                href={`/${programSlug}/workstreams/${ws._id}`}
                className="animate-card card card-interactive block p-5"
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">{ws.name}</h3>
                    <span className="mt-1 inline-flex rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                      {ws.shortCode}
                    </span>
                  </div>
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      cycleStatus(ws._id, ws.status);
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-border-default px-2 py-1 text-xs font-medium transition-colors hover:bg-interactive-hover"
                    title="Click to cycle status"
                  >
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${rag.color}`} />
                    <span className="text-text-secondary">{rag.label}</span>
                  </button>
                </div>

                <div className="space-y-1 text-sm text-text-secondary">
                  {ws.currentSprint && (
                    <p>
                      Sprint {ws.currentSprint}
                      {ws.sprintCadence ? ` · ${ws.sprintCadence}-day cadence` : ""}
                    </p>
                  )}
                </div>

                {stats && (stats.reqCount > 0 || stats.taskTotal > 0) && (
                  <div className="mt-3 border-t border-border-subtle pt-3">
                    <div className="flex items-center gap-3 text-xs text-text-secondary">
                      <span>
                        {stats.reqCount} requirement{stats.reqCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-text-muted">&middot;</span>
                      <span>
                        {stats.taskDone}/{stats.taskTotal} tasks done
                      </span>
                      {stats.taskTotal > 0 && (
                        <>
                          <span className="text-text-muted">&middot;</span>
                          <span>{Math.round((stats.taskDone / stats.taskTotal) * 100)}%</span>
                        </>
                      )}
                    </div>
                    {stats.taskTotal > 0 && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-interactive-subtle">
                        <div
                          className="h-full rounded-full bg-status-success-fg transition-all"
                          style={{
                            width: `${Math.round((stats.taskDone / stats.taskTotal) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
