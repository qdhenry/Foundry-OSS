"use client";

import type { MockRequirement } from "./pipeline-types";

type RequirementDotProps = {
  requirement: MockRequirement;
  workstreamColor: string;
  isSelected: boolean;
  isDimmed: boolean;
  stackIndex: number;
  onClick: () => void;
  onHover: (hovering: boolean) => void;
  dotId: string;
};

const HEALTH_RING: Record<string, string> = {
  on_track: "",
  at_risk: "ring-2 ring-amber-400 motion-safe:animate-pulse",
  blocked: "ring-2 ring-red-500",
};

export function RequirementDot({
  requirement,
  workstreamColor,
  isSelected,
  isDimmed,
  stackIndex,
  onClick,
  onHover,
  dotId,
}: RequirementDotProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        id={dotId}
        type="button"
        onClick={onClick}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        aria-label={`${requirement.refId}: ${requirement.title}`}
        style={{ backgroundColor: workstreamColor }}
        className={[
          "h-7 w-7 rounded-full transition-transform",
          "motion-safe:hover:scale-125",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          HEALTH_RING[requirement.health],
          isSelected && "ring-2 ring-amber-500",
          isDimmed && "opacity-20",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <span
        className={[
          "text-[8px] font-mono leading-none text-text-secondary select-none",
          isDimmed && "opacity-20",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {requirement.refId}
      </span>
    </div>
  );
}
