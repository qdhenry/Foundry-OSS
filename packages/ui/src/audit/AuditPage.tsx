"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import type { AuditEntryData } from "./AuditEntry";
import { AuditFilters } from "./AuditFilters";
import { AuditTimeline } from "./AuditTimeline";

export interface AuditPageProps {
  programId: string;
}

export function AuditPage({ programId }: AuditPageProps) {
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [limit, setLimit] = useState(50);

  const entries = useQuery(
    "auditLog:listByProgram" as any,
    programId
      ? {
          programId,
          ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
          limit,
        }
      : "skip",
  ) as AuditEntryData[] | undefined;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="type-display-m text-text-heading">Audit Trail</h1>
        {entries && (
          <p className="mt-1 text-sm text-text-secondary">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"} shown
          </p>
        )}
      </div>

      {/* Filters */}
      <AuditFilters
        entityType={entityTypeFilter}
        limit={limit}
        onEntityTypeChange={setEntityTypeFilter}
        onLimitChange={setLimit}
      />

      {/* Timeline */}
      {entries === undefined ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-text-secondary">Loading audit trail...</p>
        </div>
      ) : (
        <AuditTimeline entries={entries} />
      )}
    </div>
  );
}
