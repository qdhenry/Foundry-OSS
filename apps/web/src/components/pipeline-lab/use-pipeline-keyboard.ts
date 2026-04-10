import { useCallback, useEffect, useState } from "react";
import type { MockRequirement, PipelineStageConfig } from "./pipeline-types";

type UsePipelineKeyboardOptions = {
  stages: PipelineStageConfig[];
  requirements: MockRequirement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onClose: () => void;
};

type UsePipelineKeyboardReturn = {
  focusedStageIndex: number;
  focusedRequirementIndex: number;
  focusedRequirementId: string | null;
};

export function usePipelineKeyboard({
  stages,
  requirements,
  selectedId,
  onSelect,
  onOpen,
  onClose,
}: UsePipelineKeyboardOptions): UsePipelineKeyboardReturn {
  const [focusedStageIndex, setFocusedStageIndex] = useState(0);
  const [focusedRequirementIndex, setFocusedRequirementIndex] = useState(0);

  const getRequirementsForStage = useCallback(
    (stageIndex: number): MockRequirement[] => {
      if (stageIndex < 0 || stageIndex >= stages.length) return [];
      const stageId = stages[stageIndex].id;
      return requirements.filter((r) => r.currentStage === stageId);
    },
    [stages, requirements],
  );

  const focusedStageRequirements = getRequirementsForStage(focusedStageIndex);
  const focusedRequirementId = focusedStageRequirements[focusedRequirementIndex]?.id ?? null;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          setFocusedStageIndex((prev) => {
            const next = Math.min(prev + 1, stages.length - 1);
            setFocusedRequirementIndex(0);
            return next;
          });
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          setFocusedStageIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            setFocusedRequirementIndex(0);
            return next;
          });
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          setFocusedRequirementIndex((prev) => {
            const stageReqs = getRequirementsForStage(focusedStageIndex);
            return Math.min(prev + 1, stageReqs.length - 1);
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setFocusedRequirementIndex((prev) => Math.max(prev - 1, 0));
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (focusedRequirementId) {
            onSelect(focusedRequirementId);
            onOpen(focusedRequirementId);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          onClose();
          break;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    stages,
    focusedStageIndex,
    focusedRequirementId,
    getRequirementsForStage,
    onSelect,
    onOpen,
    onClose,
  ]);

  return {
    focusedStageIndex,
    focusedRequirementIndex,
    focusedRequirementId,
  };
}
