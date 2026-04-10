"use client";

import { useState } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { AgentStatusBadge } from "./AgentStatusBadge";

export interface AgentRow {
  _id: string;
  name: string;
  role: string;
  model: string;
  status: string;
  avatarSeed: string;
  specializations: string[];
  tasksCompleted: number;
  successRate: number;
  latestActivity: string;
}

type SortField = "name" | "role" | "status" | "tasksCompleted" | "successRate";
type SortDir = "asc" | "desc";

function modelLabel(model: string): string {
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  return model;
}

export function AgentTable({
  agents,
  onSelect,
  onDispatch,
  onArchive,
}: {
  agents: AgentRow[];
  onSelect: (agentId: string) => void;
  onDispatch: (agentId: string) => void;
  onArchive: (agentId: string) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = [...agents].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const av = a[sortField];
    const bv = b[sortField];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-default p-8 text-center">
        <p className="text-sm text-text-secondary">
          No agents yet. Create one manually or generate a team.
        </p>
      </div>
    );
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  }

  function SortableHeader({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <th
        className={`cursor-pointer select-none px-4 py-2 font-medium ${className ?? ""}`}
        onClick={() => toggleSort(field)}
      >
        {children}
        <SortIndicator field={field} />
      </th>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border-default">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-elevated text-xs text-text-secondary">
            <tr>
              <SortableHeader field="name">Agent</SortableHeader>
              <SortableHeader field="role">Role</SortableHeader>
              <th className="px-4 py-2 font-medium">Model</th>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="tasksCompleted" className="text-right">
                Tasks
              </SortableHeader>
              <SortableHeader field="successRate" className="text-right">
                Rate
              </SortableHeader>
              <th className="px-4 py-2 font-medium">Latest Activity</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((agent) => (
              <tr
                key={agent._id}
                className="cursor-pointer border-t border-border-default hover:bg-surface-subtle"
                onClick={() => onSelect(agent._id)}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <AgentAvatar seed={agent.avatarSeed} name={agent.name} />
                    <span className="font-medium text-text-heading">{agent.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-text-secondary">{agent.role}</td>
                <td className="px-4 py-2 text-text-secondary">{modelLabel(agent.model)}</td>
                <td className="px-4 py-2">
                  <AgentStatusBadge status={agent.status} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-text-heading">
                  {agent.tasksCompleted}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-text-heading">
                  {agent.successRate}%
                </td>
                <td className="max-w-[200px] truncate px-4 py-2 text-text-secondary">
                  {agent.latestActivity || "\u2014"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-medium text-accent-default hover:bg-surface-elevated"
                      onClick={() => onDispatch(agent._id)}
                    >
                      Dispatch
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-medium text-status-error-fg hover:bg-surface-elevated"
                      onClick={() => onArchive(agent._id)}
                    >
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
