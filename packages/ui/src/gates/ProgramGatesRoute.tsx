"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useProgramContext } from "../programs";
import { GateCard } from "./GateCard";

type GateType = "foundation" | "development" | "integration" | "release";
type GateStatus = "pending" | "passed" | "failed" | "overridden";

const TYPE_OPTIONS: { value: GateType | ""; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "foundation", label: "Foundation" },
  { value: "development", label: "Development" },
  { value: "integration", label: "Integration" },
  { value: "release", label: "Release" },
];

const STATUS_OPTIONS: { value: GateStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "overridden", label: "Overridden" },
];

export function ProgramGatesRoute() {
  const { programId, slug } = useProgramContext();

  const [typeFilter, setTypeFilter] = useState<GateType | "">("");
  const [statusFilter, setStatusFilter] = useState<GateStatus | "">("");

  const gates = useQuery("sprintGates:listByProgram" as any, { programId }) as any[] | undefined;
  const workstreams = useQuery("workstreams:listByProgram" as any, { programId }) as
    | { _id: string; name: string }[]
    | undefined;

  const workstreamMap = useMemo(() => {
    const map = new Map<string, string>();
    if (workstreams) {
      for (const ws of workstreams) {
        map.set(ws._id, ws.name);
      }
    }
    return map;
  }, [workstreams]);

  const filteredGates = useMemo(() => {
    if (!gates) return [];
    let result = gates;
    if (typeFilter) result = result.filter((g: { gateType: string }) => g.gateType === typeFilter);
    if (statusFilter) result = result.filter((g: { status: string }) => g.status === statusFilter);
    return result;
  }, [gates, typeFilter, statusFilter]);

  // Group by workstream
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filteredGates>();
    for (const gate of filteredGates) {
      const wsId = gate.workstreamId;
      if (!groups.has(wsId)) groups.set(wsId, []);
      groups.get(wsId)?.push(gate);
    }
    return groups;
  }, [filteredGates]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Sprint Gates</h1>
          {gates && (
            <p className="mt-1 text-sm text-text-secondary">
              {gates.length} gate{gates.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Link
          href={`/${slug}/gates/new`}
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
          New Gate
        </Link>
      </div>

      {/* Status summary */}
      {gates && gates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["pending", "passed", "failed", "overridden"] as GateStatus[]).map((status) => {
            const count = gates.filter((g: { status: string }) => g.status === status).length;
            if (count === 0) return null;
            const classes: Record<GateStatus, string> = {
              pending: "badge badge-warning",
              passed: "badge badge-success",
              failed: "badge badge-error",
              overridden: "badge badge-warning",
            };
            const labels: Record<GateStatus, string> = {
              pending: "Pending",
              passed: "Passed",
              failed: "Failed",
              overridden: "Overridden",
            };
            return (
              <span key={status} className={`inline-flex items-center gap-1.5 ${classes[status]}`}>
                {labels[status]}
                <span className="font-semibold">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as GateType | "")}
          className="select"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as GateStatus | "")}
          className="select"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Gates grouped by workstream */}
      {gates === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading gates...</p>
        </div>
      ) : filteredGates.length === 0 ? (
        <div className="card border-dashed px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
            <svg
              className="h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          {gates.length === 0 ? (
            <>
              <p className="text-lg font-semibold text-text-primary">No sprint gates yet</p>
              <p className="mt-1 text-sm text-text-secondary">
                Define quality gates to track readiness across your workstream sprints.
              </p>
              <Link
                href={`/${slug}/gates/new`}
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
                Create First Gate
              </Link>
            </>
          ) : (
            <p className="text-sm text-text-secondary">No gates match your filters</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([wsId, wsGates]) => (
            <div key={wsId}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
                {workstreamMap.get(wsId) ?? "Unknown Workstream"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {wsGates.map((gate: any) => (
                  <GateCard
                    key={gate._id}
                    gate={gate}
                    programId={programId}
                    workstreamName={workstreamMap.get(gate.workstreamId)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
