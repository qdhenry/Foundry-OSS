"use client";

import { useRef } from "react";
import { useProgressBar } from "../theme/useAnimations";

interface StageState {
  status?: string;
}

const STAGE_ORDER = [
  "containerProvision",
  "systemSetup",
  "authSetup",
  "claudeConfig",
  "gitClone",
  "depsInstall",
  "mcpInstall",
  "workspaceCustomization",
  "healthCheck",
  "ready",
] as const;

const STAGE_LABELS: Record<string, string> = {
  ready: "Ready",
  containerProvision: "Container Provision",
  systemSetup: "System Setup",
  authSetup: "Auth Setup",
  claudeConfig: "Claude Config",
  gitClone: "Git Clone",
  depsInstall: "Dependencies",
  mcpInstall: "MCP Install",
  workspaceCustomization: "Workspace Customization",
  healthCheck: "Health Check",
};

type StageTone = "pending" | "running" | "failed" | "completed";

export interface StageProgressSummary {
  totalStages: number;
  completedStages: number;
  skippedStages: number;
  runningStages: number;
  failedStages: number;
  pendingStages: number;
  progressPercent: number;
  currentStageKey: string | null;
  currentStageLabel: string | null;
  tone: StageTone;
}

interface StageProgressProps {
  setupProgress?: unknown;
  className?: string;
  compact?: boolean;
}

function asRecord(value: unknown): Record<string, StageState | undefined> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, StageState | undefined>;
  }
  return null;
}

function formatStageLabel(stageKey: string) {
  return stageKey
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (m) => m.toUpperCase())
    .trim();
}

function getStageLabel(stageKey: string) {
  return STAGE_LABELS[stageKey] ?? formatStageLabel(stageKey);
}

function getStageStatus(record: Record<string, StageState | undefined>, stageKey: string) {
  const status = record[stageKey]?.status;
  if (
    status === "pending" ||
    status === "running" ||
    status === "completed" ||
    status === "failed" ||
    status === "skipped"
  ) {
    return status;
  }
  return "pending";
}

export function summarizeSetupProgress(setupProgress?: unknown): StageProgressSummary | null {
  const progressRecord = asRecord(setupProgress);
  if (!progressRecord) return null;

  const providedKeys = Object.keys(progressRecord);
  if (providedKeys.length === 0) return null;

  const includesKnownStages = providedKeys.some((key) =>
    STAGE_ORDER.includes(key as (typeof STAGE_ORDER)[number]),
  );

  const stageKeys = includesKnownStages
    ? [
        ...STAGE_ORDER,
        ...providedKeys.filter((key) => !STAGE_ORDER.includes(key as (typeof STAGE_ORDER)[number])),
      ]
    : providedKeys;

  let completedStages = 0;
  let skippedStages = 0;
  let runningStages = 0;
  let failedStages = 0;
  let pendingStages = 0;

  for (const stageKey of stageKeys) {
    const status = getStageStatus(progressRecord, stageKey);
    if (status === "completed") completedStages += 1;
    else if (status === "skipped") skippedStages += 1;
    else if (status === "running") runningStages += 1;
    else if (status === "failed") failedStages += 1;
    else pendingStages += 1;
  }

  const progressedStages = completedStages + skippedStages + failedStages;
  const totalStages = stageKeys.length;
  const progressPercent = totalStages > 0 ? Math.round((progressedStages / totalStages) * 100) : 0;

  const runningKey =
    stageKeys.find((stageKey) => getStageStatus(progressRecord, stageKey) === "running") ?? null;
  const failedKey =
    stageKeys.find((stageKey) => getStageStatus(progressRecord, stageKey) === "failed") ?? null;
  const pendingKey =
    stageKeys.find((stageKey) => getStageStatus(progressRecord, stageKey) === "pending") ?? null;
  const completeKey =
    [...stageKeys].reverse().find((stageKey) => {
      const status = getStageStatus(progressRecord, stageKey);
      return status === "completed" || status === "skipped";
    }) ?? null;

  const currentStageKey = runningKey ?? failedKey ?? pendingKey ?? completeKey;
  const tone: StageTone =
    runningStages > 0
      ? "running"
      : pendingStages > 0
        ? "pending"
        : failedStages > 0
          ? "failed"
          : "completed";

  return {
    totalStages,
    completedStages,
    skippedStages,
    runningStages,
    failedStages,
    pendingStages,
    progressPercent,
    currentStageKey,
    currentStageLabel: currentStageKey ? getStageLabel(currentStageKey) : null,
    tone,
  };
}

export function StageProgress({ setupProgress, className, compact = false }: StageProgressProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const summary = summarizeSetupProgress(setupProgress);
  useProgressBar(barRef, summary?.progressPercent);

  if (!summary) return null;

  const progressedStages = summary.completedStages + summary.skippedStages + summary.failedStages;
  const barClass =
    summary.tone === "failed"
      ? "bg-status-error-fg"
      : summary.tone === "completed"
        ? "bg-status-success-fg"
        : "bg-accent-default";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] text-text-muted ${className ?? ""}`.trim()}
      >
        <span>{`Setup ${progressedStages}/${summary.totalStages}`}</span>
        {summary.currentStageLabel ? (
          <span className="truncate">
            {summary.tone === "failed" && summary.pendingStages === 0 && summary.runningStages === 0
              ? `\u2022 Failed: ${summary.currentStageLabel}`
              : `\u2022 ${summary.currentStageLabel}`}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border border-border-default bg-surface-raised px-3 py-2 ${className ?? ""}`.trim()}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-text-primary">Setup Progress</span>
        <span className="text-text-muted">
          {progressedStages}/{summary.totalStages}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-interactive-subtle">
        <div ref={barRef} className={`h-full ${barClass}`} style={{ width: "0%" }} />
      </div>
      {summary.currentStageLabel ? (
        <p className="mt-2 text-[11px] text-text-muted">
          {summary.tone === "failed" && summary.pendingStages === 0 && summary.runningStages === 0
            ? `Failed: ${summary.currentStageLabel}`
            : `Current stage: ${summary.currentStageLabel}`}
        </p>
      ) : null}
    </div>
  );
}
