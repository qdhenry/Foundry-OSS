"use client";

import { useProgramContext } from "@foundry/ui/programs";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IntegrationCard } from "./IntegrationCard";
import { IntegrationFilters, type IntegrationFilterValues } from "./IntegrationFilters";

export default function IntegrationsPage() {
  const { programId, slug } = useProgramContext();
  const router = useRouter();

  const [filters, setFilters] = useState<IntegrationFilterValues>({});

  const integrations = useQuery(
    "integrations:listByProgram" as any,
    programId
      ? {
          programId,
          ...(filters.type ? { type: filters.type as any } : {}),
          ...(filters.status ? { status: filters.status as any } : {}),
        }
      : "skip",
  );

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Integrations</h1>
          {integrations && (
            <p className="mt-1 text-sm text-text-secondary">
              {integrations.length} integration
              {integrations.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push(`/${slug}/integrations/new`)}
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
          Add Integration
        </button>
      </div>

      {/* Loading state */}
      {integrations === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading integrations...</p>
        </div>
      ) : integrations.length === 0 && !filters.type && !filters.status ? (
        /* Empty state */
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
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary">No integrations yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Track system-to-system connections for your migration program.
          </p>
          <button
            onClick={() => router.push(`/${slug}/integrations/new`)}
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
            Add First Integration
          </button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <IntegrationFilters filters={filters} onFilterChange={setFilters} />

          {/* Table */}
          {integrations.length === 0 ? (
            <div className="card px-6 py-12 text-center">
              <p className="text-sm font-medium text-text-secondary">
                No integrations match the current filters
              </p>
              <button
                onClick={() => setFilters({})}
                className="mt-2 text-sm text-accent-default hover:text-accent-strong"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-default">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-default bg-surface-raised">
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">Source / Target</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Linked Reqs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-surface-default">
                  {integrations.map((integration: any) => (
                    <IntegrationCard
                      key={integration._id}
                      integration={integration}
                      onClick={() => router.push(`/${slug}/integrations/${integration._id}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
