"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useProgramContext } from "../programs";
import { useStaggerEntrance } from "../theme/useAnimations";
import { SprintCard } from "./SprintCard";
import { SprintFilters } from "./SprintFilters";

type SprintStatus = "planning" | "active" | "completed" | "cancelled";

type SprintRecord = {
  _id: string;
  name: string;
  number: number;
  status: SprintStatus;
  workstreamId: string;
  startDate?: number;
  endDate?: number;
  goal?: string;
};

type WorkstreamRecord = {
  _id: string;
  name: string;
};

const STATUS_SUMMARY: Record<SprintStatus, { label: string; classes: string }> = {
  planning: { label: "Planning", classes: "badge" },
  active: { label: "Active", classes: "badge badge-success" },
  completed: { label: "Completed", classes: "badge badge-info" },
  cancelled: { label: "Cancelled", classes: "badge badge-error" },
};

export function ProgramSprintsRoute() {
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const sprintsRef = useRef<HTMLDivElement>(null);
  useStaggerEntrance(sprintsRef, ".animate-card");

  const [workstreamFilter, setWorkstreamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [formName, setFormName] = useState("");
  const [formWorkstreamId, setFormWorkstreamId] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formGoal, setFormGoal] = useState("");

  const sprints = useQuery("sprints:listByProgram" as any, {
    programId,
    ...(workstreamFilter ? { workstreamId: workstreamFilter as any } : {}),
    ...(statusFilter ? { status: statusFilter as any } : {}),
  }) as SprintRecord[] | undefined;

  const workstreams = useQuery("workstreams:listByProgram" as any, { programId }) as
    | WorkstreamRecord[]
    | undefined;
  const createSprint = useMutation("sprints:create" as any);

  const workstreamMap = useMemo(() => {
    const map = new Map<string, string>();
    if (workstreams) {
      for (const ws of workstreams) {
        map.set(ws._id, ws.name);
      }
    }
    return map;
  }, [workstreams]);

  const grouped = useMemo(() => {
    const groups = new Map<string, SprintRecord[]>();
    if (!sprints) return groups;
    for (const sprint of sprints) {
      const wsId = sprint.workstreamId;
      if (!groups.has(wsId)) groups.set(wsId, []);
      groups.get(wsId)?.push(sprint);
    }
    return groups;
  }, [sprints]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formWorkstreamId || !orgId) return;

    setIsCreating(true);
    try {
      await createSprint({
        orgId,
        programId,
        workstreamId: formWorkstreamId as any,
        name: formName.trim(),
        ...(formStartDate ? { startDate: new Date(formStartDate).getTime() } : {}),
        ...(formEndDate ? { endDate: new Date(formEndDate).getTime() } : {}),
        ...(formGoal.trim() ? { goal: formGoal.trim() } : {}),
      });
      setFormName("");
      setFormWorkstreamId("");
      setFormStartDate("");
      setFormEndDate("");
      setFormGoal("");
      setShowCreateForm(false);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Sprints</h1>
          {sprints && (
            <p className="mt-1 text-sm text-text-secondary">
              {sprints.length} sprint{sprints.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary btn-sm inline-flex items-center gap-2"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Sprint
        </button>
      </div>

      {sprints && sprints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["planning", "active", "completed", "cancelled"] as SprintStatus[]).map((status) => {
            const count = sprints.filter((s: SprintRecord) => s.status === status).length;
            if (count === 0) return null;
            const chip = STATUS_SUMMARY[status];
            return (
              <span key={status} className={`${chip.classes}`}>
                {chip.label}
                <span className="font-semibold">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      <SprintFilters
        workstreams={workstreams ?? []}
        workstreamFilter={workstreamFilter}
        onWorkstreamFilterChange={setWorkstreamFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {sprints === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading sprints...</p>
        </div>
      ) : sprints.length === 0 ? (
        <div className="card border-dashed px-6 py-16 text-center">
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
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
          </div>
          {workstreams && workstreams.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-text-primary">No sprints yet</p>
              <p className="mt-1 text-sm text-text-secondary">
                Sprints are organized by workstream. Set up workstreams first to start planning
                sprints.
              </p>
              <Link
                href={`/${slug}/workstreams`}
                className="btn-primary btn-sm mt-4 inline-flex items-center gap-2"
              >
                Set up workstreams first
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
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-text-primary">No sprints yet</p>
              <p className="mt-1 text-sm text-text-secondary">
                Create sprints to plan and track time-boxed iterations within your workstreams.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary btn-sm mt-4 inline-flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create First Sprint
              </button>
            </>
          )}
        </div>
      ) : (
        <div ref={sprintsRef} className="space-y-6">
          {Array.from(grouped.entries()).map(([wsId, wsSprints]) => (
            <div key={wsId}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                {workstreamMap.get(wsId) ?? "Unknown Workstream"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {wsSprints.map((sprint: SprintRecord) => (
                  <div key={sprint._id} className="animate-card">
                    <SprintCard
                      sprint={sprint}
                      programId={String(programId)}
                      workstreamName={workstreamMap.get(sprint.workstreamId)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <>
          <div className="modal-overlay" onClick={() => setShowCreateForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-text-primary">Create Sprint</h3>
              <form onSubmit={handleCreate} className="mt-4 space-y-4">
                <div>
                  <label className="form-label">Sprint Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Sprint 1 - Foundation"
                    required
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="form-label">Workstream</label>
                  <select
                    value={formWorkstreamId}
                    onChange={(e) => setFormWorkstreamId(e.target.value)}
                    required
                    className="select w-full"
                  >
                    <option value="">Select a workstream</option>
                    {(workstreams ?? []).map((ws: WorkstreamRecord) => (
                      <option key={ws._id} value={ws._id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Goal</label>
                  <textarea
                    value={formGoal}
                    onChange={(e) => setFormGoal(e.target.value)}
                    placeholder="What should this sprint achieve?"
                    rows={3}
                    className="textarea w-full"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !formName.trim() || !formWorkstreamId}
                    className="btn-primary disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Create Sprint"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
