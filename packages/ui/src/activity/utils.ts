// packages/ui/src/activity/utils.ts

export type ReviewStatus = "pending" | "accepted" | "revised" | "rejected";

export interface EnrichedExecution {
  _id: string;
  _creationTime: number;
  programId: string;
  skillId?: string;
  workstreamId?: string;
  taskId?: string;
  taskType: string;
  trigger: string;
  inputSummary?: string | null;
  outputSummary?: string | null;
  tokensUsed?: number | null;
  durationMs?: number | null;
  reviewStatus: ReviewStatus;
  skillName?: string | null;
  userName?: string | null;
  requirementId?: string | null;
  requirementRefId?: string | null;
  requirementTitle?: string | null;
  workstreamName?: string | null;
  taskTitle?: string | null;
}

export interface RequirementSummary {
  _id: string;
  refId: string;
  title: string;
  workstreamId?: string;
}

export type ViewState = "dashboard" | "trace" | "coverage";

// --- Detail types for expanded TraceRow ---

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  modelId: string;
}

export interface SubtaskSummary {
  _id: string;
  title: string;
  status: string;
  retryCount: number;
  executionDurationMs?: number;
  filesChanged?: string[];
  errorMessage?: string;
  commitSha?: string;
}

export interface PRSummary {
  prNumber: number;
  title: string;
  state: string;
  reviewState: string;
  ciStatus: string;
  additions: number;
  deletions: number;
  providerUrl: string;
}

export interface SandboxLogEntry {
  level: string;
  message: string;
  timestamp: number;
}

export interface SandboxSessionSummary {
  status: string;
  worktreeBranch?: string;
  commitSha?: string;
  prUrl?: string;
  filesChanged?: number;
}

export interface AuditRecord {
  _id: string;
  eventType: string;
  initiatedByName?: string;
  timestamp: number;
  outcome: {
    status: string;
    prUrl?: string;
    prNumber?: number;
    commitSha?: string;
    filesChanged?: number;
    error?: string;
  };
  reviewStatus?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNotes?: string;
}

export interface ExecutionDetail extends EnrichedExecution {
  taskDescription?: string | null;
  modelId?: string;
  auditRecords: AuditRecord[];
  costBreakdown: CostBreakdown | null;
  subtasks: SubtaskSummary[];
  pullRequests: PRSummary[];
  sandboxSession: SandboxSessionSummary | null;
  sandboxLogs: SandboxLogEntry[];
}

export interface TraceContext {
  filter: string;
  label: string;
  filterFn: (exec: EnrichedExecution) => boolean;
}

export function humanizeTaskType(taskType: string): string {
  return taskType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export function estimateCost(tokens: number): string {
  const cost = (tokens / 1_000_000) * 3;
  return cost < 0.01 ? "<$0.01" : `~$${cost.toFixed(2)}`;
}

export function sanitizePreview(text: string): string {
  let result = text;
  // Strip XML/HTML tags
  result = result.replace(/<[^>]+>/g, "");
  // Strip JSON objects (greedy — handles nested braces)
  result = result.replace(/\{[\s\S]*?\}(?=\s|$|[.,;])/g, "");
  // Strip remaining JSON-like fragments: "key":"value" patterns
  result = result.replace(/"[^"]*"\s*:\s*"[^"]*"/g, "");
  result = result.replace(/"[^"]*"\s*:\s*\d+/g, "");
  // Strip leftover brackets, quotes
  result = result.replace(/[[\]{}""]/g, "");
  // Collapse whitespace
  result = result.replace(/\s+/g, " ").trim();
  // If nothing meaningful remains, return a generic label
  return result.length > 5 ? result : "Agent execution output";
}

export function formatOutput(text: string): string {
  // Try to pretty-print JSON output
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    // Not JSON — return as-is, just trim
    return text.trim();
  }
}

export function getMetricColor(
  value: number,
  thresholds: { green: number; yellow: number },
): string {
  if (value >= thresholds.green) return "text-status-success-fg";
  if (value >= thresholds.yellow) return "text-status-warning-fg";
  return "text-status-error-fg";
}

export function getMetricBg(value: number, thresholds: { green: number; yellow: number }): string {
  if (value >= thresholds.green) return "bg-status-success-bg";
  if (value >= thresholds.yellow) return "bg-status-warning-bg";
  return "bg-status-error-bg";
}

export interface DashboardMetrics {
  acceptanceRate: number;
  acceptedCount: number;
  reviewedCount: number;
  velocityThisWeek: number;
  velocityLastWeek: number;
  velocityDelta: number;
  totalTokens: number;
  coveragePercent: number;
  coveredCount: number;
  totalRequirements: number;
}

export function computeMetrics(
  executions: EnrichedExecution[],
  totalRequirements: number,
): DashboardMetrics {
  const now = Date.now();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeekStart = now - oneWeekMs;
  const lastWeekStart = thisWeekStart - oneWeekMs;

  const reviewed = executions.filter((e) => e.reviewStatus !== "pending");
  const accepted = reviewed.filter((e) => e.reviewStatus === "accepted");
  const acceptanceRate = reviewed.length > 0 ? (accepted.length / reviewed.length) * 100 : 100;

  const thisWeek = executions.filter((e) => e._creationTime >= thisWeekStart);
  const lastWeek = executions.filter(
    (e) => e._creationTime >= lastWeekStart && e._creationTime < thisWeekStart,
  );

  const totalTokens = executions.reduce((sum, e) => sum + (e.tokensUsed ?? 0), 0);

  const coveredRequirementIds = new Set(executions.map((e) => e.requirementId).filter(Boolean));

  return {
    acceptanceRate,
    acceptedCount: accepted.length,
    reviewedCount: reviewed.length,
    velocityThisWeek: thisWeek.length,
    velocityLastWeek: lastWeek.length,
    velocityDelta: thisWeek.length - lastWeek.length,
    totalTokens,
    coveragePercent:
      totalRequirements > 0 ? (coveredRequirementIds.size / totalRequirements) * 100 : 0,
    coveredCount: coveredRequirementIds.size,
    totalRequirements,
  };
}

export interface RequirementGroup {
  requirementId: string | null;
  requirementRefId: string | null;
  requirementTitle: string | null;
  workstreamName: string | null;
  executions: EnrichedExecution[];
  successCount: number;
  totalCount: number;
  lastExecutionTime: number;
}

export function groupByRequirement(executions: EnrichedExecution[]): RequirementGroup[] {
  const groups = new Map<string, EnrichedExecution[]>();

  for (const exec of executions) {
    const key = exec.requirementId ?? `task-${exec.taskId ?? "unlinked"}`;
    const group = groups.get(key) ?? [];
    group.push(exec);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([, execs]) => {
      const first = execs[0];
      const accepted = execs.filter((e) => e.reviewStatus === "accepted").length;
      const latest = Math.max(...execs.map((e) => e._creationTime));
      return {
        requirementId: first.requirementId ?? null,
        requirementRefId: first.requirementRefId ?? null,
        requirementTitle: first.requirementTitle ?? first.taskTitle ?? "Unlinked Execution",
        workstreamName: first.workstreamName ?? null,
        executions: execs.sort((a, b) => a._creationTime - b._creationTime),
        successCount: accepted,
        totalCount: execs.length,
        lastExecutionTime: latest,
      };
    })
    .sort((a, b) => b.lastExecutionTime - a.lastExecutionTime);
}
