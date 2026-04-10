"use client";

import { useOrganization } from "@clerk/nextjs";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { slugify } from "../../../convex/model/slugify";
import { AnalysisStep } from "./wizard/AnalysisStep";
import { DocumentUploadStep, type UploadStepResult } from "./wizard/DocumentUploadStep";
import { LaunchStep } from "./wizard/LaunchStep";
import { type ProgramBasicsData, ProgramBasicsForm } from "./wizard/ProgramBasicsForm";
import { ReviewStep } from "./wizard/ReviewStep";
import { WizardStepIndicator } from "./wizard/WizardStepIndicator";

const STEPS = ["Program Setup", "Upload Documents", "Analysis", "Review Findings", "Launch"];

type WizardStep = 0 | 1 | 2 | 3 | 4;

interface ProgramWizardProps {
  resumeProgramId?: string;
}

export function ProgramWizard({ resumeProgramId }: ProgramWizardProps) {
  const [step, setStep] = useState<WizardStep>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [programId, setProgramId] = useState<string | null>(null);
  const [programSlug, setProgramSlug] = useState<string | null>(null);
  const [basicsData, setBasicsData] = useState<ProgramBasicsData>({
    name: "",
    clientName: "",
    engagementType: "",
    techStack: [],
    description: "",
    startDate: "",
    targetEndDate: "",
    workstreams: [],
  });
  const [creating, setCreating] = useState(false);
  const [queuingAnalysis, setQueuingAnalysis] = useState(false);

  const { organization } = useOrganization();
  const orgId = organization?.id ?? "";
  const createProgram = useMutation(api.programs.create);
  const updateSetupStatus = useMutation(api.programs.updateSetupStatus);
  const queueBatchAnalysis = useAction(api.documentAnalysisActions.queueBatchAnalysis);
  const router = useRouter();

  // Resume: load existing program if resumeProgramId provided
  const existingProgram = useQuery(
    api.programs.get,
    resumeProgramId ? { programId: resumeProgramId as Id<"programs"> } : "skip",
  );

  const markCompleted = useCallback((stepIndex: number) => {
    setCompletedSteps((prev) => (prev.includes(stepIndex) ? prev : [...prev, stepIndex]));
  }, []);

  const goTo = useCallback(
    (nextStep: WizardStep) => {
      markCompleted(step);
      setStep(nextStep);
    },
    [step, markCompleted],
  );

  // Resume wizard from setupStatus
  const [hasResumed, setHasResumed] = useState(false);
  useEffect(() => {
    if (!resumeProgramId || !existingProgram || hasResumed) return;
    setHasResumed(true);

    // Set program context
    setProgramId(resumeProgramId);
    setProgramSlug(existingProgram.slug ?? null);

    // Infer engagement type for legacy programs
    let engagementType = (existingProgram as any).engagementType ?? "";
    if (
      !engagementType &&
      (existingProgram as any).sourcePlatform &&
      (existingProgram as any).sourcePlatform !== "none"
    ) {
      engagementType = "migration";
    }

    setBasicsData({
      name: existingProgram.name,
      clientName: existingProgram.clientName,
      engagementType,
      techStack: (existingProgram as any).techStack ?? [],
      description: existingProgram.description ?? "",
      startDate: "",
      targetEndDate: "",
      workstreams: [],
    });

    // Derive step from setupStatus
    const status = existingProgram.setupStatus;
    if (status === "complete") {
      router.push(`/${existingProgram.slug ?? resumeProgramId}`);
      return;
    }
    if (status === "review") {
      setStep(3);
      setCompletedSteps([0, 1, 2]);
    } else if (status === "analyzing") {
      setStep(2);
      setCompletedSteps([0, 1]);
    } else {
      // "wizard" or undefined — go to upload step since program exists
      setStep(1);
      setCompletedSteps([0]);
    }
  }, [resumeProgramId, existingProgram, hasResumed, router]);

  // Step 0 → 1: Create program, then advance
  const handleBasicsNext = async () => {
    if (!orgId || creating) return;
    setCreating(true);
    try {
      const id = await createProgram({
        orgId,
        name: basicsData.name.trim(),
        clientName: basicsData.clientName.trim(),
        engagementType: basicsData.engagementType as
          | "greenfield"
          | "migration"
          | "integration"
          | "ongoing_product_dev",
        techStack: basicsData.techStack.length > 0 ? basicsData.techStack : undefined,
        workstreams: basicsData.workstreams,
        description: basicsData.description.trim() || undefined,
      });
      setProgramId(id as string);
      setProgramSlug(slugify(basicsData.name.trim()));
      goTo(1);
    } finally {
      setCreating(false);
    }
  };

  // Step 1 → 2: Documents already uploaded by DocumentUploadStep; trigger batch analysis
  const handleUploadStepNext = async ({
    documentIdsToQueue,
    alreadyQueuedDocumentIds,
  }: UploadStepResult) => {
    if (queuingAnalysis) return;
    if (!programId || !orgId) {
      goTo(2);
      return;
    }
    if (documentIdsToQueue.length === 0) {
      if (alreadyQueuedDocumentIds.length > 0) {
        updateSetupStatus({
          programId: programId as Id<"programs">,
          setupStatus: "analyzing",
        });
      }
      goTo(2);
      return;
    }
    setQueuingAnalysis(true);
    try {
      await queueBatchAnalysis({
        orgId,
        programId,
        documentIds: documentIdsToQueue,
        targetPlatform: (existingProgram as any)?.targetPlatform ?? "none",
      });
      updateSetupStatus({ programId: programId as Id<"programs">, setupStatus: "analyzing" });
      goTo(2);
    } catch (error) {
      console.error("Failed to queue analysis:", error);
      // Still advance — analysis records were created and scheduled.
      // The AI Analysis step will show real-time progress.
      updateSetupStatus({ programId: programId as Id<"programs">, setupStatus: "analyzing" });
      goTo(2);
    } finally {
      setQueuingAnalysis(false);
    }
  };

  // Step 4: Launch — navigate to program dashboard
  const handleLaunch = () => {
    if (programId) {
      updateSetupStatus({ programId: programId as Id<"programs">, setupStatus: "complete" });
      router.push(`/${programSlug ?? programId}`);
    }
  };

  if (resumeProgramId && existingProgram === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="type-display-m text-text-heading">Launch a New Program</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Define your engagement and start delivering.
        </p>
      </div>

      <WizardStepIndicator steps={STEPS} currentStep={step} completedSteps={completedSteps} />

      {step === 0 && (
        <ProgramBasicsForm data={basicsData} onChange={setBasicsData} onNext={handleBasicsNext} />
      )}

      {step === 1 && (
        <DocumentUploadStep
          programId={programId}
          orgId={orgId}
          onNext={handleUploadStepNext}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && programId && (
        <AnalysisStep
          programId={programId}
          onNext={() => {
            if (programId) {
              updateSetupStatus({ programId: programId as Id<"programs">, setupStatus: "review" });
            }
            goTo(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && programId && (
        <ReviewStep programId={programId} onNext={() => goTo(4)} onBack={() => setStep(2)} />
      )}

      {step === 4 && programId && (
        <LaunchStep programId={programId} onLaunch={handleLaunch} onBack={() => setStep(3)} />
      )}
    </div>
  );
}
