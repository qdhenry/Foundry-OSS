"use client";

import { useOrganization } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Search } from "lucide-react";
import { useState } from "react";
import { DirectoryPicker } from "./DirectoryPicker";
import { SubtaskProposalList } from "./SubtaskProposalList";

interface TaskAnalysisPanelProps {
  taskId: string;
  task: {
    _id: string;
    title: string;
    description?: string;
    acceptanceCriteria?: string[];
    programId: string;
    workstreamId?: string;
    repositoryIds?: string[];
  };
}

export function TaskAnalysisPanel({ taskId, task }: TaskAnalysisPanelProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [directoryScope, setDirectoryScope] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const subtasks = useQuery("subtasks:listByTask" as any, {
    taskId,
  }) as any[] | undefined;

  const proposals = useQuery(
    "codebaseRequirementAnalysis:getSubtaskProposals" as any,
    orgId ? { orgId, taskId } : "skip",
  ) as any[] | undefined;

  const hasRepos = (task.repositoryIds?.length ?? 0) > 0;

  if (!hasRepos) {
    return (
      <div className="rounded-lg border border-status-warning-border bg-status-warning-bg/50 p-4">
        <p className="text-sm font-medium text-status-warning-fg">
          No repositories linked to this task
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Link a repository to this task or its workstream to enable codebase analysis.
        </p>
      </div>
    );
  }

  const handleAnalyze = async () => {
    if (!orgId || !subtasks) return;
    setIsRunning(true);

    try {
      // This would call a Convex action that:
      // 1. Creates a run with scope: "task"
      // 2. Fetches directory contents from GitHub
      // 3. Calls /analyze-task-subtasks
      // 4. Stores results + proposals
      // Implementation mirrors Task 4 pattern but for task scope
      console.log("Task analysis triggered", {
        taskId,
        directoryScope,
        subtaskCount: subtasks.length,
      });
    } catch (error) {
      console.error("Task analysis failed:", error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border-default bg-surface-default p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-heading">
          Analyze Task Against Codebase
        </h3>

        <DirectoryPicker
          repoId=""
          owner=""
          repo=""
          branch="main"
          onSelect={setDirectoryScope}
          selectedPath={directoryScope}
        />

        <div className="mt-3 flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={isRunning || !subtasks?.length}
            className="flex items-center gap-2 rounded-lg bg-accent-default px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Analyze {subtasks?.length ?? 0} Subtasks
              </>
            )}
          </button>
        </div>
      </div>

      {/* Subtask proposals */}
      {proposals && proposals.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-text-heading">
            Proposed Changes ({proposals.length})
          </h3>
          <SubtaskProposalList
            proposals={proposals}
            onApprove={(id) => console.log("approve", id)}
            onReject={(id) => console.log("reject", id)}
            onBulkApprove={(ids) => console.log("bulk approve", ids)}
          />
        </div>
      )}
    </div>
  );
}
