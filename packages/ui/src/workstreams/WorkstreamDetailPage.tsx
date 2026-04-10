"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ImplementationBadge } from "../codebase-analysis/ImplementationBadge";
import { WorkstreamAnalysisTab } from "../codebase-analysis/WorkstreamAnalysisTab";
import { OrchestrationWizard } from "../orchestration/OrchestrationWizard";
import { useProgramContext } from "../programs";
import { GitHubInstallCTA, RepoPickerDropdown } from "../source-control";
import { CreateRequirementForm } from "./CreateRequirementForm";
import { WorkstreamPipelineTab } from "./pipeline/WorkstreamPipelineTab";

type Tab =
  | "pipeline"
  | "overview"
  | "requirements"
  | "tasks"
  | "gates"
  | "team"
  | "design"
  | "analysis";

type WorkstreamStatus = "on_track" | "at_risk" | "blocked";

const TABS: { key: Tab; label: string }[] = [
  { key: "pipeline", label: "Pipeline" },
  { key: "overview", label: "Overview" },
  { key: "requirements", label: "Requirements" },
  { key: "tasks", label: "Tasks" },
  { key: "gates", label: "Gates" },
  { key: "team", label: "Team" },
  { key: "design", label: "Design" },
  { key: "analysis", label: "Analysis" },
];

const STATUS_BADGE: Record<WorkstreamStatus, string> = {
  on_track: "bg-status-success-bg text-status-success-fg",
  at_risk: "bg-status-warning-bg text-status-warning-fg",
  blocked: "bg-status-error-bg text-status-error-fg",
};

const STATUS_LABEL: Record<WorkstreamStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  blocked: "Blocked",
};

const STATUS_OPTIONS: { value: WorkstreamStatus; label: string }[] = [
  { value: "on_track", label: "On Track" },
  { value: "at_risk", label: "At Risk" },
  { value: "blocked", label: "Blocked" },
];

// Requirement badges
const PRIORITY_BADGE: Record<string, string> = {
  must_have: "bg-status-error-bg text-status-error-fg",
  should_have: "bg-status-warning-bg text-status-warning-fg",
  nice_to_have: "bg-status-info-bg text-status-info-fg",
  deferred: "bg-surface-raised text-text-secondary",
};

const PRIORITY_LABEL: Record<string, string> = {
  must_have: "Must Have",
  should_have: "Should Have",
  nice_to_have: "Nice to Have",
  deferred: "Deferred",
};

const REQ_STATUS_BADGE: Record<string, string> = {
  draft: "bg-surface-raised text-text-secondary",
  approved: "bg-status-info-bg text-status-info-fg",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  complete: "bg-status-success-bg text-status-success-fg",
  deferred: "bg-surface-raised text-text-muted",
};

const REQ_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  in_progress: "In Progress",
  complete: "Complete",
  deferred: "Deferred",
};

const FIT_GAP_BADGE: Record<string, string> = {
  native: "bg-status-success-bg text-status-success-fg",
  config: "bg-status-warning-bg text-status-warning-fg",
  custom_dev: "bg-status-success-bg text-status-success-fg",
  third_party: "bg-status-warning-bg text-status-warning-fg",
  not_feasible: "bg-status-error-bg text-status-error-fg",
};

const FIT_GAP_LABEL: Record<string, string> = {
  native: "Native",
  config: "Config",
  custom_dev: "Custom Dev",
  third_party: "3rd Party",
  not_feasible: "Not Feasible",
};

// Task badges
const TASK_PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-status-error-bg text-status-error-fg",
  high: "bg-status-warning-bg text-status-warning-fg",
  medium: "bg-status-warning-bg text-status-warning-fg",
  low: "bg-status-success-bg text-status-success-fg",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  backlog: "bg-surface-raised text-text-secondary",
  todo: "bg-status-info-bg text-status-info-fg",
  in_progress: "bg-status-warning-bg text-status-warning-fg",
  review: "bg-status-info-bg text-status-info-fg",
  done: "bg-status-success-bg text-status-success-fg",
};

const TASK_STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
};

// Gate badges
const GATE_TYPE_BADGE: Record<string, string> = {
  foundation: "bg-status-info-bg text-status-info-fg",
  development: "bg-status-success-bg text-status-success-fg",
  integration: "bg-status-warning-bg text-status-warning-fg",
  release: "bg-status-success-bg text-status-success-fg",
};

const GATE_STATUS_BADGE: Record<string, string> = {
  pending: "bg-surface-raised text-text-secondary",
  passed: "bg-status-success-bg text-status-success-fg",
  failed: "bg-status-error-bg text-status-error-fg",
  overridden: "bg-status-warning-bg text-status-warning-fg",
};

const GATE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  overridden: "Overridden",
};

// Role badges
const ROLE_BADGE: Record<string, string> = {
  director: "bg-status-success-bg text-status-success-fg",
  architect: "bg-status-warning-bg text-status-warning-fg",
  developer: "bg-status-info-bg text-status-info-fg",
  ba: "bg-status-warning-bg text-status-warning-fg",
  qa: "bg-status-success-bg text-status-success-fg",
  client: "bg-surface-raised text-text-secondary",
};

const ROLE_LABEL: Record<string, string> = {
  director: "Director",
  architect: "Architect",
  developer: "Developer",
  ba: "Business Analyst",
  qa: "QA",
  client: "Client",
};

export function WorkstreamDetailPage({ workstreamId }: { workstreamId: string }) {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const { programId, slug } = useProgramContext();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tabInitialized, setTabInitialized] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showOrchWizard, setShowOrchWizard] = useState(false);

  const workstream = useQuery("workstreams:get" as any, { workstreamId });
  const updateWorkstream = useMutation("workstreams:update" as any);

  // Fetch workstream requirement count for contextual default tab
  const allWorkstreamReqs = useQuery("requirements:listByProgram" as any, {
    programId,
    workstreamId,
  });

  // Contextual default tab: Pipeline if requirements exist, Overview otherwise
  useEffect(() => {
    if (tabInitialized) return;
    if (allWorkstreamReqs === undefined) return;
    setActiveTab(allWorkstreamReqs.length > 0 ? "pipeline" : "overview");
    setTabInitialized(true);
  }, [allWorkstreamReqs, tabInitialized]);

  // Data for tabs
  const requirements = useQuery(
    "requirements:listByProgram" as any,
    activeTab === "requirements" || activeTab === "overview" ? { programId, workstreamId } : "skip",
  );

  const tasks = useQuery(
    "tasks:listByProgram" as any,
    activeTab === "tasks" || activeTab === "overview" ? { programId, workstreamId } : "skip",
  );

  const gates = useQuery(
    "sprintGates:listByWorkstream" as any,
    activeTab === "gates" || activeTab === "overview" ? { workstreamId } : "skip",
  );

  const teamMembers = useQuery(
    "teamMembers:listByProgram" as any,
    activeTab === "team" || activeTab === "overview" ? { programId } : "skip",
  );

  const designAssets = useQuery(
    "designAssets:listByWorkstream" as any,
    programId && workstreamId ? { programId, workstreamId } : "skip",
  );

  // Filter team members to this workstream
  const workstreamMembers = teamMembers?.filter((m: any) =>
    m.workstreamIds?.includes(workstreamId),
  );

  // Loading state
  if (workstream === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Loading workstream...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (workstream === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Workstream not found</p>
          <button
            onClick={() => router.back()}
            className="mt-2 text-sm text-accent-default hover:text-accent-strong"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  async function handleNameSave() {
    if (!editName.trim()) return;
    await updateWorkstream({ workstreamId, name: editName.trim() });
    setIsEditingName(false);
  }

  async function handleDescSave() {
    await updateWorkstream({
      workstreamId,
      description: editDesc.trim() || undefined,
    });
    setIsEditingDesc(false);
  }

  async function handleStatusChange(status: WorkstreamStatus) {
    await updateWorkstream({ workstreamId, status });
  }

  const reqCount = requirements?.length ?? 0;
  const taskCount = tasks?.length ?? 0;
  const gateCount = gates?.length ?? 0;
  const memberCount = workstreamMembers?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push(`/${slug}`)}
            className="mt-1 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            {/* Editable name */}
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNameSave();
                    if (e.key === "Escape") setIsEditingName(false);
                  }}
                  className="input text-lg font-bold"
                />
                <button onClick={handleNameSave} className="btn-primary btn-sm">
                  Save
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-interactive-hover"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <h1
                onClick={() => {
                  setEditName(workstream.name);
                  setIsEditingName(true);
                }}
                className="cursor-pointer text-2xl font-bold text-text-primary hover:text-accent-default"
                title="Click to edit"
              >
                {workstream.name}
              </h1>
            )}

            {/* Badges row */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-text-secondary">
                {workstream.shortCode}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[workstream.status as WorkstreamStatus]}`}
              >
                {STATUS_LABEL[workstream.status as WorkstreamStatus]}
              </span>
              <span className="text-xs text-text-muted">
                Sprint {workstream.currentSprint ?? 1}
              </span>
            </div>
          </div>
        </div>

        {/* Status control + Repo picker */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowOrchWizard(true)}
            className="btn-primary btn-sm"
          >
            Run Workstream
          </button>
          <select
            value={workstream.status}
            onChange={(e) => handleStatusChange(e.target.value as WorkstreamStatus)}
            className="select"
            style={{ width: "auto" }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <RepoPickerDropdown
            programId={workstream.programId}
            entityType="workstream"
            entityId={workstreamId}
            workstreamName={workstream.name}
          />
        </div>
      </div>

      {/* GitHub install CTA (shown when no GitHub App is installed) */}
      <GitHubInstallCTA purpose="manage workstream repos" />

      {/* Tab Bar */}
      <div className="border-b border-border-default">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            let count: number | undefined;
            if (tab.key === "requirements") count = reqCount;
            if (tab.key === "tasks") count = taskCount;
            if (tab.key === "gates") count = gateCount;
            if (tab.key === "team") count = memberCount;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-accent-default text-accent-default"
                    : "border-transparent text-text-secondary hover:border-border-strong hover:text-text-primary"
                }`}
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span className="ml-1.5 rounded-full bg-surface-raised px-1.5 py-0.5 text-xs">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "pipeline" && (
        <WorkstreamPipelineTab
          programId={String(programId)}
          workstreamId={workstreamId}
          onCreateRequirement={() => setShowCreateForm(true)}
        />
      )}
      {activeTab === "overview" && (
        <OverviewTab
          workstream={workstream}
          reqCount={reqCount}
          taskCount={taskCount}
          gateCount={gateCount}
          memberCount={memberCount}
          isEditingDesc={isEditingDesc}
          editDesc={editDesc}
          setEditDesc={setEditDesc}
          setIsEditingDesc={setIsEditingDesc}
          handleDescSave={handleDescSave}
        />
      )}
      {activeTab === "requirements" && <RequirementsTab requirements={requirements} slug={slug} />}
      {activeTab === "tasks" && <TasksTab tasks={tasks} slug={slug} />}
      {activeTab === "gates" && <GatesTab gates={gates} slug={slug} />}
      {activeTab === "team" && <TeamTab members={workstreamMembers} />}
      {activeTab === "design" && (
        <div className="space-y-4">
          {!designAssets || designAssets.length === 0 ? (
            <div className="card border-dashed px-6 py-10 text-center">
              <p className="text-sm text-text-secondary">
                No design assets attached to this workstream
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {designAssets.map((asset: any) => (
                <div key={asset._id} className="card overflow-hidden">
                  {asset.fileUrl && asset.type === "screenshot" ? (
                    <img
                      src={asset.fileUrl}
                      alt={asset.name}
                      className="h-32 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-32 items-center justify-center bg-surface-elevated">
                      <span className="text-xl text-text-muted">
                        {asset.type === "tokens" ? "{}" : "📄"}
                      </span>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-text-primary">{asset.name}</p>
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-secondary">
                      {asset.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "analysis" && (
        <WorkstreamAnalysisTab
          programId={String(programId)}
          workstreamId={workstreamId}
          repositoryIds={(workstream?.repositoryIds ?? []).map(String)}
        />
      )}

      <CreateRequirementForm
        programId={programId as string}
        workstreams={[]}
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
      />

      {showOrchWizard && orgId && (
        <OrchestrationWizard
          orgId={orgId}
          programId={programId}
          onClose={() => setShowOrchWizard(false)}
          onComplete={(orchRunId) => {
            setShowOrchWizard(false);
            router.push(`/${programId}/orchestration/${orchRunId}`);
          }}
          initialScope={{ scopeType: "workstream", workstreamId }}
        />
      )}
    </div>
  );
}

/* ─── Overview Tab ─────────────────────────────────────────────── */

function OverviewTab({
  workstream,
  reqCount,
  taskCount,
  gateCount,
  memberCount,
  isEditingDesc,
  editDesc,
  setEditDesc,
  setIsEditingDesc,
  handleDescSave,
}: {
  workstream: {
    name: string;
    shortCode: string;
    status: string;
    description?: string;
    sprintCadence?: number;
    currentSprint?: number;
    _creationTime: number;
  };
  reqCount: number;
  taskCount: number;
  gateCount: number;
  memberCount: number;
  isEditingDesc: boolean;
  editDesc: string;
  setEditDesc: (v: string) => void;
  setIsEditingDesc: (v: boolean) => void;
  handleDescSave: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left column */}
      <div className="space-y-6 lg:col-span-2">
        {/* Description */}
        <div className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-secondary">Description</h2>
            {!isEditingDesc && (
              <button
                onClick={() => {
                  setEditDesc(workstream.description ?? "");
                  setIsEditingDesc(true);
                }}
                className="text-xs font-medium text-accent-default hover:text-accent-strong"
              >
                Edit
              </button>
            )}
          </div>
          {isEditingDesc ? (
            <div className="space-y-2">
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={4}
                className="textarea"
              />
              <div className="flex items-center gap-2">
                <button onClick={handleDescSave} className="btn-primary btn-sm">
                  Save
                </button>
                <button
                  onClick={() => setIsEditingDesc(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-interactive-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">
              {workstream.description || "No description provided."}
            </p>
          )}
        </div>
      </div>

      {/* Right column: metadata */}
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="card p-4">
          <h3 className="mb-3 text-xs font-medium text-text-secondary">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-raised p-3 text-center">
              <p className="text-lg font-bold text-text-primary">{reqCount}</p>
              <p className="text-xs text-text-secondary">Requirements</p>
            </div>
            <div className="rounded-lg bg-surface-raised p-3 text-center">
              <p className="text-lg font-bold text-text-primary">{taskCount}</p>
              <p className="text-xs text-text-secondary">Tasks</p>
            </div>
            <div className="rounded-lg bg-surface-raised p-3 text-center">
              <p className="text-lg font-bold text-text-primary">{gateCount}</p>
              <p className="text-xs text-text-secondary">Gates</p>
            </div>
            <div className="rounded-lg bg-surface-raised p-3 text-center">
              <p className="text-lg font-bold text-text-primary">{memberCount}</p>
              <p className="text-xs text-text-secondary">Members</p>
            </div>
          </div>
        </div>

        {/* Sprint Info */}
        <div className="card p-4">
          <h3 className="mb-2 text-xs font-medium text-text-secondary">Sprint Info</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Current Sprint</span>
              <span className="font-medium text-text-primary">{workstream.currentSprint ?? 1}</span>
            </div>
            {workstream.sprintCadence && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Cadence</span>
                <span className="font-medium text-text-primary">
                  {workstream.sprintCadence} weeks
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Created */}
        <div className="card p-4">
          <label className="mb-1 block text-xs font-medium text-text-secondary">Created</label>
          <p className="text-sm text-text-secondary">
            {new Date(workstream._creationTime).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Requirements Tab ─────────────────────────────────────────── */

const IMPL_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "not_found", label: "Not Found" },
  { value: "needs_verification", label: "Needs Verification" },
  { value: "partially_implemented", label: "Partially Implemented" },
  { value: "fully_implemented", label: "Fully Implemented" },
  { value: "unanalyzed", label: "Not Analyzed" },
];

function RequirementsTab({
  requirements,
  slug,
}: {
  requirements:
    | Array<{
        _id: string;
        refId: string;
        title: string;
        priority: string;
        status: string;
        fitGap: string;
        implementationStatus?: string;
        implementationConfidence?: number;
        lastAnalyzedAt?: number;
      }>
    | undefined;
  slug: string;
}) {
  const [implFilter, setImplFilter] = useState("all");

  if (requirements === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-raised" />
        ))}
      </div>
    );
  }

  if (requirements.length === 0) {
    return (
      <div className="card p-8 text-center">
        <svg
          className="mx-auto mb-3 h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
          />
        </svg>
        <p className="text-sm text-text-secondary">No requirements assigned to this workstream.</p>
      </div>
    );
  }

  const filtered =
    implFilter === "all"
      ? requirements
      : implFilter === "unanalyzed"
        ? requirements.filter((r) => !r.implementationStatus)
        : requirements.filter((r) => r.implementationStatus === implFilter);

  return (
    <div className="space-y-3">
      {/* Implementation status filter */}
      <div className="flex items-center gap-2">
        <select
          value={implFilter}
          onChange={(e) => setImplFilter(e.target.value)}
          className="select text-xs"
        >
          {IMPL_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-text-muted">
          {filtered.length} of {requirements.length} requirements
        </span>
      </div>

      <div className="space-y-2">
        {filtered.map((req) => (
          <Link
            key={req._id}
            href={`/${slug}/discovery`}
            className="card card-interactive flex items-center gap-3 px-4 py-3"
          >
            <span className="w-20 shrink-0 font-mono text-xs font-medium text-text-secondary">
              {req.refId}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
              {req.title}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_BADGE[req.priority] ?? ""}`}
            >
              {PRIORITY_LABEL[req.priority] ?? req.priority}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REQ_STATUS_BADGE[req.status] ?? ""}`}
            >
              {REQ_STATUS_LABEL[req.status] ?? req.status}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${FIT_GAP_BADGE[req.fitGap] ?? ""}`}
            >
              {FIT_GAP_LABEL[req.fitGap] ?? req.fitGap}
            </span>
            <ImplementationBadge
              status={req.implementationStatus}
              confidence={req.implementationConfidence}
              lastAnalyzedAt={req.lastAnalyzedAt}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Tasks Tab ────────────────────────────────────────────────── */

function TasksTab({
  tasks,
  slug,
}: {
  tasks:
    | Array<{
        _id: string;
        title: string;
        priority: string;
        status: string;
        assigneeName?: string;
      }>
    | undefined;
  slug: string;
}) {
  if (tasks === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-raised" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="card p-8 text-center">
        <svg
          className="mx-auto mb-3 h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-1.007.661-1.862 1.573-2.148M15.75 9.75l-3 3m0 0l-3-3m3 3V2.25"
          />
        </svg>
        <p className="text-sm text-text-secondary">No tasks for this workstream yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Link
          key={task._id}
          href={`/${slug}/tasks`}
          className="card card-interactive flex items-center gap-3 px-4 py-3"
        >
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
            {task.title}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TASK_PRIORITY_BADGE[task.priority] ?? ""}`}
          >
            {task.priority}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_BADGE[task.status] ?? ""}`}
          >
            {TASK_STATUS_LABEL[task.status] ?? task.status}
          </span>
          {task.assigneeName && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-text-secondary">
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {task.assigneeName}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/* ─── Gates Tab ────────────────────────────────────────────────── */

function GatesTab({
  gates,
  slug,
}: {
  gates:
    | Array<{
        _id: string;
        name: string;
        gateType: string;
        status: string;
        criteria: Array<{ title: string; passed: boolean }>;
      }>
    | undefined;
  slug: string;
}) {
  if (gates === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-raised" />
        ))}
      </div>
    );
  }

  if (gates.length === 0) {
    return (
      <div className="card p-8 text-center">
        <svg
          className="mx-auto mb-3 h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
          />
        </svg>
        <p className="text-sm text-text-secondary">No sprint gates defined for this workstream.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {gates.map((gate) => {
        const passedCount = gate.criteria.filter((c) => c.passed).length;
        const totalCriteria = gate.criteria.length;
        return (
          <Link
            key={gate._id}
            href={`/${slug}/gates`}
            className="card card-interactive flex items-center gap-3 px-4 py-3"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
              {gate.name}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${GATE_TYPE_BADGE[gate.gateType] ?? ""}`}
            >
              {gate.gateType}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${GATE_STATUS_BADGE[gate.status] ?? ""}`}
            >
              {GATE_STATUS_LABEL[gate.status] ?? gate.status}
            </span>
            <span className="shrink-0 text-xs text-text-muted">
              {passedCount}/{totalCriteria} criteria
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── Team Tab ─────────────────────────────────────────────────── */

function TeamTab({
  members,
}: {
  members:
    | Array<{
        _id: string;
        role: string;
        user: { name: string; email: string; avatarUrl?: string } | null;
      }>
    | undefined;
}) {
  if (members === undefined) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-raised" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="card p-8 text-center">
        <svg
          className="mx-auto mb-3 h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
          />
        </svg>
        <p className="text-sm text-text-secondary">No team members assigned to this workstream.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div key={member._id} className="card flex items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-medium text-text-secondary">
            {member.user?.name?.charAt(0)?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {member.user?.name ?? "Unknown User"}
            </p>
            {member.user?.email && (
              <p className="truncate text-xs text-text-muted">{member.user.email}</p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[member.role] ?? ""}`}
          >
            {ROLE_LABEL[member.role] ?? member.role}
          </span>
        </div>
      ))}
    </div>
  );
}
