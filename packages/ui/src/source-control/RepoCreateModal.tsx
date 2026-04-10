"use client";

import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { useGitHubInstallation } from "./useGitHubInstallation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RepoCreateModalProps {
  programId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (repoId: string) => void;
}

interface PlatformTemplate {
  name: string;
  fullName: string;
}

interface OrgTemplate {
  name: string;
  fullName: string;
}

// ---------------------------------------------------------------------------
// Static platform templates
// ---------------------------------------------------------------------------

const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  { name: "None", fullName: "" },
  { name: "Next.js Starter", fullName: "vercel/nextjs-starter" },
  { name: "Salesforce B2B Scaffold", fullName: "forcedotcom/salesforce-b2b-scaffold" },
  { name: "BigCommerce B2B Scaffold", fullName: "bigcommerce/b2b-scaffold" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPermissionError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string" ? err.toLowerCase() : ((err as any)?.message?.toLowerCase() ?? "");
  return msg.includes("403") || msg.includes("permission") || msg.includes("forbidden");
}

// ---------------------------------------------------------------------------
// RepoCreateModal
// ---------------------------------------------------------------------------

export function RepoCreateModal({ programId, isOpen, onClose, onCreated }: RepoCreateModalProps) {
  const { orgId, activeInstallation } = useGitHubInstallation();

  const provisionFromTemplate = useAction(
    "sourceControl/provisioning:provisionFromTemplate" as any,
  );
  const listOrgTemplates = useAction("sourceControl/templates:listOrgTemplateRepos" as any);

  const [repoName, setRepoName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [selectedTemplateFullName, setSelectedTemplateFullName] = useState("");
  const [orgTemplates, setOrgTemplates] = useState<OrgTemplate[]>([]);
  const [loadingOrgTemplates, setLoadingOrgTemplates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch org templates when modal opens
  useEffect(() => {
    if (!isOpen || !activeInstallation || !orgId) return;

    setLoadingOrgTemplates(true);
    listOrgTemplates({
      installationId: activeInstallation.installationId,
      orgId,
    })
      .then((result: any) => {
        const templates: OrgTemplate[] = (result ?? []).map((t: any) => ({
          name: t.name ?? t.full_name ?? t.fullName ?? "",
          fullName: t.full_name ?? t.fullName ?? "",
        }));
        setOrgTemplates(templates);
      })
      .catch(() => {
        // Silently fail — org templates are optional
        setOrgTemplates([]);
      })
      .finally(() => {
        setLoadingOrgTemplates(false);
      });
  }, [isOpen, activeInstallation?.installationId, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setRepoName("");
      setIsPrivate(true);
      setSelectedTemplateFullName("");
      setOrgTemplates([]);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const allTemplateOptions = [
    ...PLATFORM_TEMPLATES,
    ...orgTemplates.filter((ot) => !PLATFORM_TEMPLATES.some((pt) => pt.fullName === ot.fullName)),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = repoName.trim();
    if (!trimmedName) {
      setError("Repository name is required.");
      return;
    }

    if (!selectedTemplateFullName) {
      setError("Empty repo creation coming soon. Please select a template.");
      return;
    }

    if (!activeInstallation) {
      setError("No active GitHub installation found.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await provisionFromTemplate({
        programId: programId as any,
        installationId: activeInstallation.installationId,
        owner: activeInstallation.accountLogin,
        repoName: trimmedName,
        isPrivate,
        templateRepoFullName: selectedTemplateFullName,
        variables: {
          projectPrefix: trimmedName.replace(/[^a-zA-Z0-9]/g, ""),
          clientName: activeInstallation.accountLogin,
          orgAlias: activeInstallation.accountLogin,
          scratchOrgAlias: `${trimmedName}-scratch`,
        },
      });

      const repoId = typeof result === "string" ? result : (result?.repoId ?? result?._id ?? "");
      onCreated?.(repoId);
      onClose();
    } catch (err: unknown) {
      if (isPermissionError(err)) {
        setError(
          "Permission denied. The Foundry GitHub App may not have sufficient access to create repositories in your organization. Please review the GitHub App permissions in your GitHub App settings.",
        );
      } else {
        const msg =
          typeof err === "string"
            ? err
            : ((err as any)?.data ?? (err as any)?.message ?? "Failed to create repository.");
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay flex items-center justify-center">
      <div className="modal max-w-md p-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-heading">Create Repository</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-interactive-hover hover:text-text-primary"
            aria-label="Close"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repo name */}
          <div className="space-y-1.5">
            <label htmlFor="repo-name" className="block text-sm font-medium text-text-secondary">
              Repository Name
            </label>
            <input
              id="repo-name"
              type="text"
              placeholder="my-repo-name"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              disabled={submitting}
              className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default disabled:opacity-50"
            />
          </div>

          {/* Visibility toggle */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-text-secondary">Visibility</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsPrivate(true)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  isPrivate
                    ? "border-accent-default bg-status-info-bg text-accent-default"
                    : "border-border-default bg-surface-raised text-text-secondary hover:bg-interactive-hover"
                }`}
              >
                Private
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsPrivate(false)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                  !isPrivate
                    ? "border-accent-default bg-status-info-bg text-accent-default"
                    : "border-border-default bg-surface-raised text-text-secondary hover:bg-interactive-hover"
                }`}
              >
                Public
              </button>
            </div>
          </div>

          {/* Template selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="template-select"
              className="block text-sm font-medium text-text-secondary"
            >
              Template
            </label>
            {loadingOrgTemplates ? (
              <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-3 py-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-default border-t-transparent" />
                <span className="text-sm text-text-muted">Loading templates...</span>
              </div>
            ) : (
              <select
                id="template-select"
                value={selectedTemplateFullName}
                onChange={(e) => setSelectedTemplateFullName(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent-default focus:outline-none focus:ring-1 focus:ring-accent-default disabled:opacity-50"
              >
                {allTemplateOptions.map((tpl) => (
                  <option key={tpl.fullName} value={tpl.fullName}>
                    {tpl.name}
                    {tpl.fullName ? ` (${tpl.fullName})` : ""}
                  </option>
                ))}
              </select>
            )}
            {!selectedTemplateFullName && !loadingOrgTemplates && (
              <p className="text-xs text-text-muted">
                Empty repo creation coming soon. Please select a template.
              </p>
            )}
          </div>

          {/* Error box */}
          {error && (
            <div className="rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2">
              <p className="text-xs text-status-error-fg">{error}</p>
              {isPermissionError(error) && (
                <a
                  href="https://github.com/settings/installations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-xs font-medium text-accent-default underline hover:text-accent-strong"
                >
                  Review GitHub App settings
                </a>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-border-default bg-surface-default px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-raised disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !repoName.trim()}
              className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-text-on-brand hover:bg-accent-strong disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-on-brand border-t-transparent" />
                  Creating...
                </span>
              ) : (
                "Create Repository"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// XIcon — close button icon
// ---------------------------------------------------------------------------

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
