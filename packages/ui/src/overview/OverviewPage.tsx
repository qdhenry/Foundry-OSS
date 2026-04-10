"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AgentTeamCard } from "../mission-control/AgentTeamCard";
import { DailyDigest } from "../mission-control/DailyDigest";
import { DependencySuggestions } from "../mission-control/DependencySuggestions";
import { PipelineProgressWidget } from "../mission-control/PipelineProgressWidget";
import type { ProgramData } from "../programs/ProgramContext";
import { useFadeIn } from "../theme/useAnimations";
import { KpiCards } from "./KpiCards";
import { type Workstream, WorkstreamGrid } from "./WorkstreamGrid";

const PHASE_COLORS: Record<ProgramData["phase"], string> = {
  discovery: "bg-status-info-bg text-status-info-fg",
  build: "bg-status-warning-bg text-status-warning-fg",
  test: "bg-status-success-bg text-status-success-fg",
  deploy: "bg-status-warning-bg text-status-warning-fg",
  complete: "bg-status-success-bg text-status-success-fg",
};

const STATUS_COLORS: Record<ProgramData["status"], string> = {
  active: "bg-status-success-bg text-status-success-fg",
  paused: "bg-status-warning-bg text-status-warning-fg",
  complete: "bg-surface-raised text-text-secondary",
  archived: "bg-surface-raised text-text-muted",
};

interface OnboardingStep {
  step: number;
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
  complete: boolean;
}

type Skill = {
  _id: string;
};

export interface OverviewPageProps {
  program: ProgramData;
  programId: string;
  programSlug: string;
}

export function OverviewPage({ program, programId, programSlug }: OverviewPageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lastVisitTime, setLastVisitTime] = useState<number>(0);

  const workstreams = useQuery(
    "workstreams:listByProgram" as any,
    programId ? { programId } : "skip",
  ) as Workstream[] | undefined;

  const skills = useQuery("skills:listByProgram" as any, programId ? { programId } : "skip") as
    | Skill[]
    | undefined;

  useFadeIn(contentRef, !!workstreams);

  // Track last visit time for AI pulse briefing
  useEffect(() => {
    const storageKey = `missionControl:lastVisit:${programId}`;
    const stored = localStorage.getItem(storageKey);
    const lastVisit = stored ? parseInt(stored, 10) : Date.now() - 24 * 60 * 60 * 1000;

    setLastVisitTime(lastVisit);
    localStorage.setItem(storageKey, Date.now().toString());
  }, [programId]);

  const workstreamHealth = {
    onTrack: workstreams?.filter((ws) => ws.status === "on_track").length ?? 0,
    atRisk: workstreams?.filter((ws) => ws.status === "at_risk").length ?? 0,
    blocked: workstreams?.filter((ws) => ws.status === "blocked").length ?? 0,
  };

  const requirementCount = program.stats.totalRequirements;
  const skillCount = skills?.length ?? 0;
  const executionCount = program.stats.agentExecutionCount;

  // Contextual onboarding — only for truly empty programs
  const isProgramEmpty = requirementCount === 0 && skillCount === 0 && executionCount === 0;

  const onboardingSteps: OnboardingStep[] = [
    {
      step: 1,
      title: "Add your first requirement",
      description: "Capture gap analysis findings from your platform audit.",
      href: `/${programSlug}/discovery`,
      ctaLabel: "Go to Discovery",
      complete: requirementCount > 0,
    },
    {
      step: 2,
      title: "Create a skill to power AI agents",
      description: "Define agent instruction sets for architecture, development, or testing.",
      href: `/${programSlug}/skills`,
      ctaLabel: "Go to Skills",
      complete: skillCount > 0,
    },
    {
      step: 3,
      title: "Execute your first AI agent",
      description: "Run an AI agent with project context to generate deliverables.",
      href: `/${programSlug}/activity`,
      ctaLabel: "Go to Activity",
      complete: executionCount > 0,
    },
  ];

  const allComplete = onboardingSteps.every((step) => step.complete);
  const currentStep = onboardingSteps.find((step) => !step.complete);

  return (
    <div ref={contentRef}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="type-display-m text-text-heading">Mission Control</h1>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PHASE_COLORS[program.phase]}`}
          >
            {program.phase}
          </span>
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[program.status]}`}
          >
            {program.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          {program.name} - {program.clientName}
        </p>
      </div>

      {/* Contextual Onboarding */}
      {isProgramEmpty && !allComplete && skills !== undefined && (
        <div className="mb-8 rounded-xl border border-border-accent bg-interactive-subtle p-5">
          <h2 className="mb-1 text-sm font-semibold text-accent-default">Getting Started</h2>
          <p className="mb-4 text-xs text-text-secondary">
            Complete these steps to set up your program.
          </p>
          <div className="space-y-3">
            {onboardingSteps.map((step) => (
              <div
                key={step.step}
                className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
                  step.complete
                    ? "border-status-success-border bg-status-success-bg"
                    : step === currentStep
                      ? "border-border-accent bg-surface-default"
                      : "border-border-default bg-surface-default"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.complete
                      ? "bg-status-success-bg text-status-success-fg"
                      : step === currentStep
                        ? "bg-interactive-subtle text-accent-default"
                        : "bg-surface-raised text-text-muted"
                  }`}
                >
                  {step.complete ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.step
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      step.complete ? "text-status-success-fg line-through" : "text-text-primary"
                    }`}
                  >
                    {step.title}
                  </p>
                  {!step.complete && (
                    <p className="text-xs text-text-secondary">{step.description}</p>
                  )}
                </div>
                {step === currentStep && (
                  <Link href={step.href} className="btn-primary btn-sm shrink-0">
                    {step.ctaLabel}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Pulse Briefing */}
      {lastVisitTime > 0 && (
        <div className="mb-8">
          <DailyDigest programId={programId} lastVisitTime={lastVisitTime} />
        </div>
      )}

      {/* Dynamic KPI Cards */}
      <div className="mb-8">
        <KpiCards stats={program.stats} workstreamHealth={workstreamHealth} />
      </div>

      {/* Agent Team */}
      <div className="mb-8">
        <AgentTeamCard programId={programId} programSlug={programSlug} />
      </div>

      {/* Workstream Health */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Workstream Health</h2>
        {workstreams === undefined ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-xl bg-surface-raised" />
            ))}
          </div>
        ) : (
          <WorkstreamGrid workstreams={workstreams} programId={programId} />
        )}
      </section>

      {/* Pipeline Progress */}
      <section className="mb-8">
        <PipelineProgressWidget programId={programId} />
      </section>

      {/* Dependency Suggestions (only shown when pending) */}
      <DependencySuggestions programId={programId} />
    </div>
  );
}
