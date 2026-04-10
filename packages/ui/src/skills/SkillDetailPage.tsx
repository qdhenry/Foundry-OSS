"use client";

import { useOrganization } from "@clerk/nextjs";
import { useProgramContext } from "@foundry/ui/programs";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTabIndicator } from "../theme/useAnimations";
import { SkillEditor } from "./SkillEditor";
import { VersionDiff } from "./VersionDiff";
import { VersionHistory } from "./VersionHistory";

type Domain =
  | "architecture"
  | "backend"
  | "frontend"
  | "integration"
  | "deployment"
  | "testing"
  | "review"
  | "project";
type Status = "draft" | "active" | "deprecated";

const DOMAIN_BADGE: Record<Domain, string> = {
  architecture: "bg-status-success-bg text-status-success-fg",
  backend: "bg-status-info-bg text-status-info-fg",
  frontend: "bg-status-warning-bg text-status-warning-fg",
  integration: "bg-status-warning-bg text-status-warning-fg",
  deployment: "bg-status-success-bg text-status-success-fg",
  testing: "bg-status-error-bg text-status-error-fg",
  review: "bg-status-error-bg text-status-error-fg",
  project: "bg-surface-raised text-text-secondary",
};

const DOMAIN_LABEL: Record<Domain, string> = {
  architecture: "Architecture",
  backend: "Backend",
  frontend: "Frontend",
  integration: "Integration",
  deployment: "Deployment",
  testing: "Testing",
  review: "Review",
  project: "Project",
};

const STATUS_BADGE: Record<Status, string> = {
  draft: "bg-surface-raised text-text-secondary",
  active: "bg-status-success-bg text-status-success-fg",
  deprecated: "bg-status-error-bg text-status-error-fg",
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  active: "Active",
  deprecated: "Deprecated",
};

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "deprecated", label: "Deprecated" },
];

type SidebarTab = "metadata" | "requirements" | "versions";

export default function SkillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const skillId = params.skillId as string;
  const { programId, slug } = useProgramContext();
  const { organization } = useOrganization();

  const skill = useQuery("skills:get" as any, skillId ? { skillId } : "skip");
  const allRequirements = useQuery(
    "requirements:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  const updateSkill = useMutation("skills:update" as any);
  const updateContent = useMutation("skills:updateContent" as any);
  const linkRequirement = useMutation("skills:linkRequirement" as any);
  const unlinkRequirement = useMutation("skills:unlinkRequirement" as any);

  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("metadata");
  const [showReqSearch, setShowReqSearch] = useState(false);
  const [reqSearchQuery, setReqSearchQuery] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [changeMessage, setChangeMessage] = useState("");
  const [diffVersions, setDiffVersions] = useState<{ a: string; b: string } | null>(null);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);

  const sidebarTabContainerRef = useRef<HTMLDivElement>(null);
  const sidebarTabIndicatorRef = useRef<HTMLDivElement>(null);
  useTabIndicator(sidebarTabIndicatorRef, sidebarTabContainerRef, `[data-tab="${sidebarTab}"]`);

  const viewingVersion = useQuery(
    "skillVersions:get" as any,
    viewingVersionId ? { versionId: viewingVersionId } : "skip",
  );

  if (skill === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading skill...</p>
      </div>
    );
  }

  if (skill === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Skill not found</p>
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

  const currentContent = editedContent ?? skill.content;
  const hasChanges = editedContent !== null && editedContent !== skill.content;

  async function handleSave() {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      await updateContent({
        skillId,
        content: editedContent!,
        message: changeMessage.trim() || undefined,
      });
      setEditedContent(null);
      setShowSavePrompt(false);
      setChangeMessage("");
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setIsSaving(false);
    }
  }

  function handleStatusChange(status: Status) {
    updateSkill({ skillId, status });
  }

  function handleLinkRequirement(reqId: string) {
    linkRequirement({ skillId, requirementId: reqId });
    setShowReqSearch(false);
    setReqSearchQuery("");
  }

  function handleUnlinkRequirement(reqId: string) {
    unlinkRequirement({ skillId, requirementId: reqId });
  }

  const linkedReqIds = new Set(skill.resolvedRequirements?.map((r: any) => r._id) ?? []);
  const filteredReqOptions = (allRequirements ?? []).filter(
    (r: any) =>
      !linkedReqIds.has(r._id) &&
      (reqSearchQuery === "" ||
        r.refId.toLowerCase().includes(reqSearchQuery.toLowerCase()) ||
        r.title.toLowerCase().includes(reqSearchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/${slug}/skills`)}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-interactive-hover hover:text-text-secondary"
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
            <h1 className="type-display-m text-text-heading">{skill.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${DOMAIN_BADGE[skill.domain as Domain]}`}
              >
                {DOMAIN_LABEL[skill.domain as Domain]}
              </span>
              <span className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-xs text-text-secondary">
                {skill.currentVersion}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[skill.status as Status]}`}
              >
                {STATUS_LABEL[skill.status as Status]}
              </span>
            </div>
          </div>
        </div>

        {/* Save button */}
        {hasChanges && (
          <button
            onClick={() => setShowSavePrompt(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Save Changes
          </button>
        )}
      </div>

      {/* Viewing old version notice */}
      {viewingVersion && (
        <div className="flex items-center justify-between rounded-lg bg-status-warning-bg px-4 py-2">
          <span className="text-sm text-status-warning-fg">
            Viewing version {viewingVersion.version}
            {viewingVersion.message && ` — "${viewingVersion.message}"`}
          </span>
          <button
            onClick={() => setViewingVersionId(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-status-warning-fg hover:bg-interactive-hover"
          >
            Back to current
          </button>
        </div>
      )}

      {/* Diff viewer */}
      {diffVersions && (
        <VersionDiff
          versionAId={diffVersions.a}
          versionBId={diffVersions.b}
          onClose={() => setDiffVersions(null)}
        />
      )}

      {/* Main content + sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="lg:col-span-2">
          <SkillEditor
            content={viewingVersion ? viewingVersion.content : currentContent}
            onChange={(content) => {
              if (!viewingVersionId) setEditedContent(content);
            }}
            readOnly={!!viewingVersionId}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Tab selector */}
          <div
            ref={sidebarTabContainerRef}
            className="relative flex rounded-lg bg-surface-raised p-1"
          >
            {(["metadata", "requirements", "versions"] as const).map((tab) => (
              <button
                key={tab}
                data-tab={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  sidebarTab === tab
                    ? "bg-surface-default text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab === "requirements" ? "Reqs" : tab}
              </button>
            ))}
            <div
              ref={sidebarTabIndicatorRef}
              className="absolute bottom-0 h-0.5 bg-accent-default transition-none"
              style={{ pointerEvents: "none" }}
            />
          </div>

          <div className="card p-4">
            {/* Metadata tab */}
            {sidebarTab === "metadata" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Status</label>
                  <select
                    value={skill.status}
                    onChange={(e) => handleStatusChange(e.target.value as Status)}
                    className="select w-full"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Domain</label>
                  <p className="text-sm text-text-secondary">
                    {DOMAIN_LABEL[skill.domain as Domain]}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">
                    Target Platform
                  </label>
                  <p className="text-sm text-text-secondary">
                    {skill.targetPlatform === "salesforce_b2b"
                      ? "Salesforce B2B"
                      : skill.targetPlatform === "bigcommerce_b2b"
                        ? "BigCommerce B2B"
                        : "Platform Agnostic"}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Version</label>
                  <p className="font-mono text-sm text-text-secondary">{skill.currentVersion}</p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-muted">Lines</label>
                  <p className="text-sm text-text-secondary">{skill.lineCount}</p>
                </div>
              </div>
            )}

            {/* Requirements tab */}
            {sidebarTab === "requirements" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-xs font-medium text-text-muted">
                    Linked Requirements ({skill.resolvedRequirements?.length ?? 0})
                  </label>
                  <button
                    onClick={() => setShowReqSearch(!showReqSearch)}
                    className="text-xs font-medium text-accent-default hover:text-accent-strong"
                  >
                    {showReqSearch ? "Cancel" : "+ Link"}
                  </button>
                </div>

                {showReqSearch && (
                  <div className="mb-3">
                    <input
                      value={reqSearchQuery}
                      onChange={(e) => setReqSearchQuery(e.target.value)}
                      placeholder="Search requirements..."
                      className="input mb-1 w-full"
                    />
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-border-default">
                      {filteredReqOptions.slice(0, 10).map((r: any) => (
                        <button
                          key={r._id}
                          onClick={() => handleLinkRequirement(r._id)}
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-interactive-hover"
                        >
                          <span className="font-mono text-xs text-text-muted">{r.refId}</span>
                          <span className="truncate text-text-secondary">{r.title}</span>
                        </button>
                      ))}
                      {filteredReqOptions.length === 0 && (
                        <p className="px-2 py-1.5 text-xs text-text-muted">
                          No matching requirements
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {(skill.resolvedRequirements ?? []).map((req: any) => (
                    <div
                      key={req._id}
                      className="flex items-center justify-between rounded-lg bg-surface-raised px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="font-mono text-xs text-text-muted">{req.refId}</span>
                        <span className="truncate text-xs text-text-secondary">{req.title}</span>
                      </div>
                      <button
                        onClick={() => handleUnlinkRequirement(req._id)}
                        className="ml-1 shrink-0 text-text-muted hover:text-status-error-fg"
                      >
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {(skill.resolvedRequirements ?? []).length === 0 && !showReqSearch && (
                    <p className="text-xs text-text-muted">No linked requirements</p>
                  )}
                </div>
              </div>
            )}

            {/* Versions tab */}
            {sidebarTab === "versions" && (
              <VersionHistory
                skillId={skillId}
                onViewVersion={(versionId) => {
                  setViewingVersionId(versionId);
                  setDiffVersions(null);
                }}
                onCompare={(a, b) => {
                  setDiffVersions({ a, b });
                  setViewingVersionId(null);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Save prompt modal */}
      {showSavePrompt && (
        <>
          <div className="modal-overlay" onClick={() => setShowSavePrompt(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-3 text-lg font-semibold text-text-primary">Save Changes</h3>
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Change Message (optional)
                </label>
                <input
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  placeholder="e.g. Updated error handling section"
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  className="input w-full"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowSavePrompt(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="btn-primary disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Version"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
