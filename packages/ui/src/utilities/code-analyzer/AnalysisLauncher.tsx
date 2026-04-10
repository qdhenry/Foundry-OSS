"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";

type SourceMode = "linked" | "manual";

export interface AnalysisLauncherProps {
  programId: string;
  orgId: string;
  onAnalysisStarted?: (id: string) => void;
}

const GITHUB_URL_PATTERN = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/;

export function AnalysisLauncher({ programId, orgId, onAnalysisStarted }: AnalysisLauncherProps) {
  const [sourceMode, setSourceMode] = useState<SourceMode>("linked");
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedRepoFullName, setSelectedRepoFullName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkedRepos = useQuery(
    "sourceControl/repositories:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as Array<{ _id: string; repoFullName: string }> | undefined;

  const createAnalysis = useMutation("codebaseAnalysis:create" as any);
  const runAnalysis = useAction("codebaseAnalysisActions:runAnalysis" as any);

  const isValidUrl = GITHUB_URL_PATTERN.test(repoUrl.trim());
  const hasLinkedSelection = sourceMode === "linked" && selectedRepoFullName !== "";
  const canSubmit =
    sourceMode === "manual" ? isValidUrl && !isRunning : hasLinkedSelection && !isRunning;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setIsRunning(true);

    try {
      const resolvedUrl =
        sourceMode === "linked" ? `https://github.com/${selectedRepoFullName}` : repoUrl.trim();
      const repoName =
        sourceMode === "linked" ? selectedRepoFullName : new URL(resolvedUrl).pathname.slice(1);

      const analysisId = await createAnalysis({
        orgId,
        programId,
        repoUrl: resolvedUrl,
        repoName,
      });

      onAnalysisStarted?.(String(analysisId));

      await runAnalysis({
        analysisId: String(analysisId),
        orgId,
        repoUrl: resolvedUrl,
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to start analysis");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-secondary p-5">
      <h2 className="mb-4 text-sm font-semibold text-text-heading">New Analysis</h2>

      {/* Source mode toggle */}
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-default p-1">
        <button
          onClick={() => setSourceMode("linked")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
            sourceMode === "linked"
              ? "bg-accent-default text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Linked Repository
        </button>
        <button
          onClick={() => setSourceMode("manual")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
            sourceMode === "manual"
              ? "bg-accent-default text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Manual URL
        </button>
      </div>

      {sourceMode === "linked" ? (
        <div className="mb-4">
          <label className="form-label">Repository</label>
          {linkedRepos === undefined ? (
            <div className="flex h-10 items-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
            </div>
          ) : linkedRepos.length === 0 ? (
            <>
              <select disabled className="select w-full opacity-60">
                <option>No linked repositories</option>
              </select>
              <p className="mt-1 text-xs text-text-muted">
                Link a GitHub repository in Settings to use this option.
              </p>
            </>
          ) : (
            <select
              value={selectedRepoFullName}
              onChange={(e) => {
                setSelectedRepoFullName(e.target.value);
                setError(null);
              }}
              className="select w-full"
            >
              <option value="">Select a repository…</option>
              {linkedRepos.map((repo) => (
                <option key={repo._id} value={repo.repoFullName}>
                  {repo.repoFullName}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <label className="form-label">GitHub Repository URL</label>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              setError(null);
            }}
            placeholder="https://github.com/owner/repo"
            className="input w-full"
          />
          {repoUrl && !isValidUrl && (
            <p className="mt-1 text-xs text-status-error-fg">
              Enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2 text-sm text-status-error-fg">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Analyzing...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
            </svg>
            Analyze Repository
          </>
        )}
      </button>
    </div>
  );
}
