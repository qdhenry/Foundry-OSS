"use client";

import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { useState } from "react";
import { AnalysisActivityLog } from "./AnalysisActivityLog";
import { AnalysisProgress } from "./AnalysisProgress";
import { ChatPanel } from "./ChatPanel";
import { KnowledgeGraphTab } from "./KnowledgeGraphTab";
import { TourViewer } from "./TourViewer";

type Tab = "graph" | "chat" | "tours";

const TABS: { key: Tab; label: string }[] = [
  { key: "graph", label: "Graph" },
  { key: "chat", label: "Chat" },
  { key: "tours", label: "Tours" },
];

export interface CodeAnalyzerDetailPageProps {
  analysisId: string;
}

export function CodeAnalyzerDetailPage({ analysisId }: CodeAnalyzerDetailPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("graph");
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const analysis = useQuery(
    "codebaseAnalysis:get" as any,
    isAuthenticated && orgId ? { analysisId, orgId } : "skip",
  ) as any | undefined;

  if (analysis === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  if (analysis === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-text-secondary">Analysis not found.</p>
      </div>
    );
  }

  const isComplete = analysis.status === "completed";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="type-display-m text-text-heading">
          {analysis.repoUrl ? extractRepoName(analysis.repoUrl) : "Code Analysis"}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {isComplete
            ? "Analysis complete. Explore the knowledge graph, chat with the codebase, or take a guided tour."
            : "Analysis in progress..."}
        </p>
      </div>

      {/* Progress stepper + activity log (shown when not complete) */}
      {!isComplete && (
        <div>
          <div className="rounded-xl border border-border-default bg-surface-secondary p-5">
            <AnalysisProgress status={analysis.status} currentStage={analysis.currentStage} />
          </div>
          {orgId && <AnalysisActivityLog analysisId={analysisId} orgId={orgId} />}
        </div>
      )}

      {/* Tabs (shown when complete) */}
      {isComplete && (
        <>
          <div className="border-b border-border-default">
            <nav className="-mb-px flex gap-6">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? "border-accent-default text-accent-default"
                      : "border-transparent text-text-secondary hover:border-border-default hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div>
            {activeTab === "graph" && orgId && (
              <KnowledgeGraphTab analysisId={analysisId} orgId={orgId} />
            )}
            {activeTab === "chat" && orgId && <ChatPanel analysisId={analysisId} orgId={orgId} />}
            {activeTab === "tours" && orgId && <TourViewer analysisId={analysisId} orgId={orgId} />}
          </div>
        </>
      )}
    </div>
  );
}

function extractRepoName(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : url;
  } catch {
    return url;
  }
}
