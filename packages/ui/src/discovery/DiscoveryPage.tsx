"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useProgramContext } from "../programs";
import { VideosPage } from "../videos/VideosPage";
import { CreateRequirementForm } from "./CreateRequirementForm";
import { DiscoveryDocumentZone, type DocumentSortOrder } from "./DiscoveryDocumentZone";
import { DiscoveryEmptyState } from "./DiscoveryEmptyState";
import { DiscoveryFindingsReview, type FindingsTab } from "./DiscoveryFindingsReview";
import { DiscoveryNextStepCard } from "./DiscoveryNextStepCard";
import { DiscoveryStats } from "./DiscoveryStats";
import { type DiscoveryTab, DiscoveryTabBar } from "./DiscoveryTabBar";
import { DiscoveryWorkflowBanner } from "./DiscoveryWorkflowBanner";
import { RecentlyImportedTable } from "./RecentlyImportedTable";

function resolveTabParam(searchParams: URLSearchParams): DiscoveryTab {
  const tab = searchParams.get("tab");
  if (tab === "documents" || tab === "findings" || tab === "imported" || tab === "videos")
    return tab;
  // Backward compat: ?section=documents
  if (searchParams.get("section") === "documents") return "documents";
  return "documents";
}

export function DiscoveryPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";

  const { program, programId, slug } = useProgramContext();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState<DiscoveryTab>(() => resolveTabParam(searchParams));
  const [activeFindingTab, setActiveFindingTab] = useState<FindingsTab>("requirement");
  const [docSortOrder, setDocSortOrder] = useState<DocumentSortOrder>("newest");

  // ── Convex subscriptions (kept at page level for persistence across tabs) ──

  const allRequirements = useQuery(
    "requirements:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const _statusCounts = useQuery(
    "requirements:countByStatus" as any,
    programId ? { programId } : "skip",
  );

  const documents = useQuery("documents:listByProgram" as any, programId ? { programId } : "skip");

  const pendingFindings = useQuery(
    "discoveryFindings:countPending" as any,
    programId ? { programId } : "skip",
  );

  const findingStatusCounts = useQuery(
    "discoveryFindings:countByStatus" as any,
    programId ? { programId } : "skip",
  ) as Record<string, number> | undefined;

  const recentlyImported = useQuery("requirements:recentlyImported" as any, {
    programId,
    limit: 20,
  });

  const unassignedCounts = useQuery(
    "requirements:countUnassigned" as any,
    programId ? { programId } : "skip",
  ) as { count: number; total: number } | undefined;

  const videoAnalyses = useQuery(
    "videoAnalysis:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as any[] | undefined;

  const pendingFindingsCount = pendingFindings?.count ?? 0;

  const analyzingCount = useMemo(() => {
    if (!documents) return 0;
    return documents.filter((document: any) => {
      const status = document.analysisStatus ?? "none";
      return status === "queued" || status === "analyzing";
    }).length;
  }, [documents]);

  const importedCount =
    (recentlyImported as any)?.totalCount ?? recentlyImported?.items.length ?? 0;
  const reAnalyzeTargetPlatform =
    program.targetPlatform === "salesforce_b2b" || program.targetPlatform === "bigcommerce_b2b"
      ? program.targetPlatform
      : "salesforce_b2b";

  // ── Tab navigation ──

  const switchTab = useCallback(
    (tab: DiscoveryTab) => {
      setActiveTab(tab);
      router.replace(`/${slug}/discovery?tab=${tab}`, { scroll: false });
    },
    [slug, router],
  );

  // Sync URL param on initial load / back-forward navigation
  useEffect(() => {
    const resolved = resolveTabParam(searchParams);
    if (resolved !== activeTab) {
      setActiveTab(resolved);
    }
    // Only react to searchParams changes, not activeTab
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ── Empty state check ──

  const showDiscoveryEmptyState =
    allRequirements !== undefined &&
    allRequirements.length === 0 &&
    documents !== undefined &&
    documents.length === 0 &&
    pendingFindingsCount === 0;

  if (showDiscoveryEmptyState) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="type-display-m text-text-heading">Discovery Hub</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Upload, analyze, review, and import findings without leaving discovery.
            </p>
          </div>
        </div>
        <DiscoveryEmptyState
          onCreateRequirement={() => setShowCreateForm(true)}
          onOpenDocuments={() => switchTab("documents")}
        />
        <CreateRequirementForm
          programId={programId}
          workstreams={workstreams ?? []}
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="type-display-m text-text-heading">Discovery Hub</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Upload, analyze, review, and import findings without leaving discovery.
          </p>
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
          Create Requirement
        </button>
      </div>

      {/* Stats row */}
      <DiscoveryStats
        documentCount={documents?.length ?? 0}
        pendingFindingsCount={pendingFindingsCount}
        requirementsCount={importedCount}
        analyzingCount={analyzingCount}
        onStatClick={switchTab}
      />

      {/* Next Step card — shown when unassigned requirements exist */}
      {unassignedCounts && unassignedCounts.count > 0 && (
        <DiscoveryNextStepCard
          unassignedCount={unassignedCounts.count}
          totalCount={unassignedCounts.total}
          workstreams={workstreams ?? []}
          programId={programId}
          slug={slug}
        />
      )}

      {/* Tab bar */}
      <DiscoveryTabBar
        activeTab={activeTab}
        onTabChange={switchTab}
        documentCount={documents?.length ?? 0}
        analyzingCount={analyzingCount}
        pendingFindingsCount={pendingFindingsCount}
        importedCount={importedCount}
        videoCount={videoAnalyses?.length}
      />

      {/* Workflow banner */}
      <DiscoveryWorkflowBanner
        activeTab={activeTab}
        documentCount={documents?.length ?? 0}
        pendingFindingsCount={pendingFindingsCount}
        approvedCount={(findingStatusCounts?.approved ?? 0) + (findingStatusCounts?.edited ?? 0)}
        importedCount={importedCount}
        onSwitchTab={switchTab}
      />

      {/* Tab content */}
      {activeTab === "documents" && (
        <DiscoveryDocumentZone
          programId={programId}
          orgId={orgId}
          targetPlatform={reAnalyzeTargetPlatform}
          sortOrder={docSortOrder}
          onSortOrderChange={setDocSortOrder}
        />
      )}

      {activeTab === "findings" && (
        <DiscoveryFindingsReview
          programId={programId}
          orgId={orgId}
          activeTab={activeFindingTab}
          onTabChange={setActiveFindingTab}
        />
      )}

      {activeTab === "imported" && (
        <RecentlyImportedTable
          programId={programId}
          data={recentlyImported}
          workstreams={workstreams ?? []}
        />
      )}

      {activeTab === "videos" && <VideosPage />}

      <CreateRequirementForm
        programId={programId}
        workstreams={workstreams ?? []}
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
      />
    </div>
  );
}

export default DiscoveryPage;
