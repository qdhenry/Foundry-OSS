"use client";

import { useParams } from "next/navigation";
import { CodeAnalyzerDetailPage } from "./CodeAnalyzerDetailPage";

export function ProgramCodeAnalyzerDetailRoute() {
  const params = useParams();
  const analysisId = params.analysisId as string;

  if (!analysisId) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-text-secondary">No analysis ID provided.</p>
      </div>
    );
  }

  return <CodeAnalyzerDetailPage analysisId={analysisId} />;
}
