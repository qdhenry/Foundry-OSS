const STAGES = [
  { key: "uploading", label: "Uploading", tsKey: "uploadingAt" },
  { key: "indexing", label: "Indexing", tsKey: "indexingAt" },
  { key: "analyzing", label: "Analyzing", tsKey: "analyzingAt" },
  { key: "complete", label: "Complete", tsKey: "completedAt" },
] as const;

type StageTimestamps = Record<string, number | undefined>;
type StageKey = (typeof STAGES)[number]["key"];
type StageState = "completed" | "current" | "failed" | "pending";

const LEGACY_STAGE_MAP: Record<string, StageKey> = {
  extracting: "indexing",
  transcribing: "indexing",
  classifying_frames: "indexing",
  awaiting_speakers: "analyzing",
  synthesizing: "analyzing",
};

interface PipelineProgressProps {
  status: string;
  stageTimestamps?: StageTimestamps;
  failedStage?: string;
  failedError?: string;
}

function normalizeStage(stage?: string): StageKey | undefined {
  if (!stage) return undefined;
  if (STAGES.some((entry) => entry.key === stage)) {
    return stage as StageKey;
  }
  return LEGACY_STAGE_MAP[stage];
}

function lastTimestampedStageIndex(stageTimestamps: StageTimestamps): number {
  return STAGES.reduce((last, stage, index) => {
    if (typeof stageTimestamps[stage.tsKey] === "number") return index;
    return last;
  }, -1);
}

function stageState(
  stageKey: StageKey,
  currentStatus: string,
  stageTimestamps: StageTimestamps,
  failedStage?: string,
): StageState {
  const stageIndex = STAGES.findIndex((s) => s.key === stageKey);
  const normalizedCurrent = normalizeStage(currentStatus);

  if (currentStatus === "failed") {
    const normalizedFailed = normalizeStage(failedStage);
    if (normalizedFailed === stageKey) return "failed";

    const failedIndex = normalizedFailed
      ? STAGES.findIndex((s) => s.key === normalizedFailed)
      : Math.min(lastTimestampedStageIndex(stageTimestamps) + 1, STAGES.length - 1);

    if (stageIndex < failedIndex) return "completed";
    if (stageIndex === failedIndex) return "failed";
    return "pending";
  }

  if (currentStatus === "complete") return "completed";

  const currentIndex = normalizedCurrent
    ? STAGES.findIndex((s) => s.key === normalizedCurrent)
    : lastTimestampedStageIndex(stageTimestamps);

  if (currentIndex < 0) {
    return stageIndex === 0 ? "current" : "pending";
  }

  if (stageIndex < currentIndex) return "completed";
  if (stageIndex === currentIndex) {
    return "current";
  }
  return "pending";
}

function formatFailedStage(stage?: string): string | null {
  if (!stage) return null;
  const normalized = normalizeStage(stage);
  if (normalized) {
    return STAGES.find((entry) => entry.key === normalized)?.label ?? null;
  }
  return stage.replaceAll("_", " ");
}

export function PipelineProgress({
  status,
  stageTimestamps = {},
  failedStage,
  failedError,
}: PipelineProgressProps) {
  const failedStageLabel = formatFailedStage(failedStage);

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-4 sm:p-6">
      <h3 className="mb-4 text-sm font-semibold text-text-heading">Pipeline Progress</h3>

      <div className="flex items-center gap-0">
        {STAGES.map((stage, idx) => {
          const state = stageState(stage.key, status, stageTimestamps, failedStage);
          return (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <StageIndicator state={state} />
                <span
                  className={`mt-1.5 text-[10px] font-medium sm:text-xs ${
                    state === "completed"
                      ? "text-status-success-fg"
                      : state === "current"
                        ? "text-accent-default"
                        : state === "failed"
                          ? "text-status-error-fg"
                          : "text-text-muted"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {idx < STAGES.length - 1 && (
                <div
                  className={`mx-1 h-0.5 w-4 sm:w-8 ${
                    stageState(STAGES[idx + 1].key, status, stageTimestamps, failedStage) !==
                    "pending"
                      ? "bg-status-success-fg"
                      : "bg-border-default"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {status === "failed" && failedError && (
        <div className="mt-3 rounded-lg border border-status-error-border bg-status-error-bg px-3 py-2">
          <p className="text-xs text-status-error-fg">
            {failedStageLabel ? `Failed at: ${failedStageLabel}. ` : ""}
            {failedError}
          </p>
        </div>
      )}
    </div>
  );
}

function StageIndicator({ state }: { state: StageState }) {
  if (state === "completed") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-status-success-fg">
        <svg
          className="h-3 w-3 text-text-on-brand"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }

  if (state === "current") {
    return (
      <div className="relative flex h-6 w-6 items-center justify-center">
        <div className="absolute h-6 w-6 animate-ping rounded-full bg-blue-400/30" />
        <div className="h-3 w-3 rounded-full bg-blue-500" />
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-status-error-fg">
        <svg
          className="h-3 w-3 text-text-on-brand"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-6 w-6 items-center justify-center">
      <div className="h-2.5 w-2.5 rounded-full bg-border-default" />
    </div>
  );
}
