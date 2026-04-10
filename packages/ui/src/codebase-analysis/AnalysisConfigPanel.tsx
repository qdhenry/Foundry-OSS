"use client";

import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { useState } from "react";

export interface AnalysisConfig {
  branch: string;
  directoryFilter: string;
  fileTypeFilter: string[];
  confidenceThreshold: number;
  modelTier: "fast" | "standard" | "thorough";
  useKnowledgeGraph: boolean;
}

interface AnalysisConfigPanelProps {
  defaultBranch?: string;
  onRun: (config: AnalysisConfig) => void;
  isRunning: boolean;
  hasRepos: boolean;
}

const PRESETS: Record<string, Partial<AnalysisConfig>> = {
  quick: { modelTier: "fast", confidenceThreshold: 90, useKnowledgeGraph: false },
  standard: { modelTier: "standard", confidenceThreshold: 90, useKnowledgeGraph: true },
  deep: { modelTier: "thorough", confidenceThreshold: 80, useKnowledgeGraph: true },
};

export function AnalysisConfigPanel({
  defaultBranch = "main",
  onRun,
  isRunning,
  hasRepos,
}: AnalysisConfigPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState<AnalysisConfig>({
    branch: defaultBranch,
    directoryFilter: "",
    fileTypeFilter: [],
    confidenceThreshold: 90,
    modelTier: "standard",
    useKnowledgeGraph: true,
  });

  const applyPreset = (preset: keyof typeof PRESETS) => {
    setConfig((prev) => ({ ...prev, ...PRESETS[preset] }));
  };

  if (!hasRepos) {
    return (
      <div className="rounded-lg border border-status-warning-border bg-status-warning-bg/50 p-4">
        <p className="text-sm font-medium text-status-warning-fg">No repositories linked</p>
        <p className="mt-1 text-xs text-text-secondary">
          Connect a repository to this workstream before running analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border-default bg-surface-default p-4">
      {/* Preset buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text-secondary">Depth:</span>
        {(["quick", "standard", "deep"] as const).map((preset) => (
          <button
            key={preset}
            onClick={() => applyPreset(preset)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              config.modelTier === PRESETS[preset].modelTier
                ? "bg-accent-default text-white"
                : "bg-surface-raised text-text-secondary hover:bg-surface-elevated"
            }`}
          >
            {preset.charAt(0).toUpperCase() + preset.slice(1)}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Advanced
          {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Advanced config */}
      {showAdvanced && (
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border-default pt-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Branch</label>
            <input
              type="text"
              value={config.branch}
              onChange={(e) => setConfig((prev) => ({ ...prev, branch: e.target.value }))}
              className="w-full rounded-md border border-border-default bg-surface-default px-2.5 py-1.5 text-xs text-text-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Directory filter
            </label>
            <input
              type="text"
              value={config.directoryFilter}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  directoryFilter: e.target.value,
                }))
              }
              placeholder="e.g., src/features"
              className="w-full rounded-md border border-border-default bg-surface-default px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              Confidence threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={50}
                max={100}
                value={config.confidenceThreshold}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    confidenceThreshold: Number(e.target.value),
                  }))
                }
                className="flex-1"
              />
              <span className="w-8 text-right text-xs font-mono text-text-secondary">
                {config.confidenceThreshold}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="useKg"
              checked={config.useKnowledgeGraph}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  useKnowledgeGraph: e.target.checked,
                }))
              }
              className="rounded border-border-default"
            />
            <label htmlFor="useKg" className="text-xs text-text-secondary">
              Use knowledge graph (if available)
            </label>
          </div>
        </div>
      )}

      {/* Run button */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onRun(config)}
          disabled={isRunning}
          className="rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {isRunning ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Analyzing...
            </span>
          ) : (
            "Analyze Codebase"
          )}
        </button>
      </div>
    </div>
  );
}
