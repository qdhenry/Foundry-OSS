"use client";

import { useProgramContext } from "@foundry/ui/programs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlaybookCard } from "./PlaybookCard";

type Status = "draft" | "published" | "archived";

const STATUS_TABS: { value: Status | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export default function PlaybooksPage() {
  const { programId, slug } = useProgramContext();
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<Status | "">("");

  const playbooks = useQuery(
    "playbooks:listByProgram" as any,
    programId
      ? {
          programId,
          ...(statusFilter ? { status: statusFilter } : {}),
        }
      : "skip",
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Playbooks</h1>
          {playbooks && (
            <p className="mt-1 text-sm text-text-secondary">
              {playbooks.length} playbook{playbooks.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push(`/${slug}/playbooks/new`)}
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
          Create Playbook
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value as Status | "")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-interactive-subtle text-accent-default"
                : "bg-surface-raised text-text-secondary hover:bg-interactive-hover"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Playbook grid */}
      {playbooks === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading playbooks...</p>
        </div>
      ) : playbooks.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
          </svg>
          <p className="text-sm font-medium text-text-secondary">No playbooks found</p>
          <p className="mt-1 text-xs text-text-muted">
            {statusFilter
              ? "No playbooks match the current filter. Try a different status."
              : "Create your first playbook to define reusable migration workflows."}
          </p>
          {statusFilter && (
            <button
              onClick={() => setStatusFilter("")}
              className="mt-3 text-sm font-medium text-accent-default hover:text-accent-strong"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((playbook: any) => (
            <PlaybookCard key={playbook._id} playbook={playbook} programId={programId as string} />
          ))}
        </div>
      )}
    </div>
  );
}
