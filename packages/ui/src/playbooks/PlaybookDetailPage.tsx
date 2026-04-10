"use client";

import { useProgramContext } from "@foundry/ui/programs";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { InstanceCard } from "./InstanceCard";

type TargetPlatform =
  | "salesforce_b2b"
  | "bigcommerce_b2b"
  | "sitecore"
  | "wordpress"
  | "none"
  | "platform_agnostic";
type Status = "draft" | "published" | "archived";

const STATUS_BADGE: Record<Status, string> = {
  draft: "badge",
  published: "badge badge-success",
  archived: "badge badge-warning",
};

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const PLATFORM_BADGE: Record<TargetPlatform, string> = {
  salesforce_b2b: "badge badge-info",
  bigcommerce_b2b: "badge badge-success",
  sitecore: "badge badge-error",
  wordpress: "badge badge-warning",
  none: "badge",
  platform_agnostic: "badge",
};

const PLATFORM_LABEL: Record<TargetPlatform, string> = {
  salesforce_b2b: "Salesforce B2B Commerce",
  bigcommerce_b2b: "BigCommerce B2B",
  sitecore: "Sitecore",
  wordpress: "WordPress",
  none: "None",
  platform_agnostic: "Platform Agnostic",
};

export default function PlaybookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playbookId = params.playbookId as string;
  const { programId, slug } = useProgramContext();

  const playbook = useQuery(
    "playbooks:get" as any,
    playbookId ? { playbookId: playbookId as any } : "skip",
  );

  const instances = useQuery(
    "playbooks:listInstances" as any,
    playbookId ? { playbookId: playbookId as any } : "skip",
  );

  const publishPlaybook = useMutation("playbooks:publish" as any);
  const archivePlaybook = useMutation("playbooks:archive" as any);
  const removePlaybook = useMutation("playbooks:remove" as any);
  const instantiatePlaybook = useMutation("playbooks:instantiate" as any);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInstantiateModal, setShowInstantiateModal] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [isInstantiating, setIsInstantiating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  if (playbook === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-text-secondary">Loading playbook...</p>
      </div>
    );
  }

  if (playbook === null) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-primary">Playbook not found</p>
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

  async function handlePublish() {
    setIsPublishing(true);
    try {
      await publishPlaybook({ playbookId: playbookId as any });
    } catch (err) {
      console.error("Failed to publish playbook:", err);
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleArchive() {
    setIsArchiving(true);
    try {
      await archivePlaybook({ playbookId: playbookId as any });
    } catch (err) {
      console.error("Failed to archive playbook:", err);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await removePlaybook({ playbookId: playbookId as any });
      router.push(`/${slug}/playbooks`);
    } catch (err) {
      console.error("Failed to delete playbook:", err);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleInstantiate() {
    if (!instanceName.trim()) return;
    setIsInstantiating(true);
    try {
      await instantiatePlaybook({
        playbookId: playbookId as any,
        instanceName: instanceName.trim(),
      });
      setShowInstantiateModal(false);
      setInstanceName("");
    } catch (err) {
      console.error("Failed to instantiate playbook:", err);
    } finally {
      setIsInstantiating(false);
    }
  }

  // Compute total estimated hours
  const totalHours = playbook.resolvedSteps.reduce(
    (sum: number, step: any) => sum + (step.estimatedHours ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push(`/${slug}/playbooks`)}
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
            <h1 className="type-display-m text-text-heading">{playbook.name}</h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className={`${STATUS_BADGE[playbook.status as Status]}`}>
                {STATUS_LABEL[playbook.status as Status]}
              </span>
              <span className={`${PLATFORM_BADGE[playbook.targetPlatform as TargetPlatform]}`}>
                {PLATFORM_LABEL[playbook.targetPlatform as TargetPlatform]}
              </span>
              <span className="text-xs text-text-muted">
                {playbook.resolvedSteps.length} step
                {playbook.resolvedSteps.length !== 1 ? "s" : ""}
                {totalHours > 0 && ` / ${totalHours}h estimated`}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {playbook.status === "draft" && (
            <>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="rounded-lg bg-status-success-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {isPublishing ? "Publishing..." : "Publish"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg p-2 text-text-muted transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
                title="Delete playbook"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </>
          )}
          {playbook.status === "published" && (
            <>
              <button
                onClick={() => {
                  setInstanceName(`${playbook.name} - ${new Date().toLocaleDateString()}`);
                  setShowInstantiateModal(true);
                }}
                className="btn-primary btn-sm inline-flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Instantiate
              </button>
              <button
                onClick={handleArchive}
                disabled={isArchiving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
              >
                {isArchiving ? "Archiving..." : "Archive"}
              </button>
            </>
          )}
          {playbook.status === "archived" && (
            <span className="text-xs text-text-muted">This playbook is archived</span>
          )}
        </div>
      </div>

      {/* Description */}
      {playbook.description && (
        <div className="card p-5">
          <h2 className="mb-2 text-sm font-semibold text-text-secondary">Description</h2>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{playbook.description}</p>
        </div>
      )}

      {/* Steps list */}
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold text-text-secondary">
          Steps ({playbook.resolvedSteps.length})
        </h2>
        {playbook.resolvedSteps.length === 0 ? (
          <p className="text-sm text-text-muted">No steps defined.</p>
        ) : (
          <div className="space-y-3">
            {playbook.resolvedSteps.map((step: any, index: number) => (
              <div
                key={index}
                className="flex gap-3 rounded-lg border border-border-subtle bg-surface-raised p-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-interactive-subtle text-xs font-bold text-accent-default">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{step.title}</p>
                  {step.description && (
                    <p className="mt-1 text-xs text-text-secondary">{step.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center gap-3">
                    {step.workstreamName && (
                      <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                        {step.workstreamShortCode} - {step.workstreamName}
                      </span>
                    )}
                    {step.estimatedHours !== undefined && step.estimatedHours !== null && (
                      <span className="text-[10px] text-text-muted">
                        {step.estimatedHours}h est.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instances section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Instances
          {instances && instances.length > 0 && (
            <span className="ml-2 text-sm font-normal text-text-muted">({instances.length})</span>
          )}
        </h2>
        {instances === undefined ? (
          <p className="text-sm text-text-secondary">Loading instances...</p>
        ) : instances.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="text-sm text-text-secondary">
              No instances yet.
              {playbook.status === "published" &&
                " Click Instantiate to create tasks from this playbook."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {instances.map((instance: any) => (
              <InstanceCard key={instance._id} instance={instance} />
            ))}
          </div>
        )}
      </div>

      {/* Instantiate modal */}
      {showInstantiateModal && (
        <>
          <div className="modal-overlay" onClick={() => setShowInstantiateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Instantiate Playbook</h3>
              <p className="mb-4 text-sm text-text-secondary">
                This will create {playbook.resolvedSteps.length} task
                {playbook.resolvedSteps.length !== 1 ? "s" : ""} from the playbook steps.
              </p>
              <div className="mb-4">
                <label className="form-label">Instance Name</label>
                <input
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="e.g. Sprint 3 Migration Run"
                  className="input w-full"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowInstantiateModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInstantiate}
                  disabled={!instanceName.trim() || isInstantiating}
                  className="btn-primary disabled:opacity-50"
                >
                  {isInstantiating
                    ? "Creating tasks..."
                    : `Create ${playbook.resolvedSteps.length} Tasks`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <>
          <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="modal w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="mb-2 text-lg font-semibold text-text-primary">Delete Playbook</h3>
              <p className="mb-4 text-sm text-text-secondary">
                Are you sure you want to delete &ldquo;{playbook.name}&rdquo;? This action cannot be
                undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-interactive-hover"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-status-error-fg px-4 py-2 text-sm font-medium text-text-on-brand transition-colors hover:opacity-90 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
