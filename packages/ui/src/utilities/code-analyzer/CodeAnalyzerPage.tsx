"use client";

import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { useProgramContext } from "../../programs/ProgramContext";
import { AnalysisLauncher } from "./AnalysisLauncher";
import { AnalysisList } from "./AnalysisList";

export function CodeAnalyzerPage() {
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const { programId, slug } = useProgramContext();

  const analyses = useQuery(
    "codebaseAnalysis:listByProgram" as any,
    isAuthenticated && orgId ? { orgId, programId: String(programId) } : "skip",
  ) as any[] | undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="type-display-m text-text-heading">Code Analyzer</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Analyze a repository to generate a knowledge graph, guided code tours, and AI-powered
          codebase Q&A.
        </p>
      </div>

      {orgId && <AnalysisLauncher programId={String(programId)} orgId={orgId} />}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-heading">Previous Analyses</h2>
        {analyses === undefined ? (
          <div className="flex h-32 items-center justify-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          </div>
        ) : analyses.length === 0 ? (
          <div className="rounded-xl border border-border-default bg-surface-secondary p-8 text-center">
            <p className="text-sm text-text-secondary">
              No analyses yet. Start one above to get started.
            </p>
          </div>
        ) : (
          <AnalysisList analyses={analyses} slug={slug} />
        )}
      </div>
    </div>
  );
}
