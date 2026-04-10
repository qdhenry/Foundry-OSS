"use client";

import { useOrganization } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { ProvisionFromTemplate } from "../../source-control/ProvisionFromTemplate";

interface LaunchStepProps {
  programId: string;
  onLaunch: () => void;
  onBack: () => void;
}

type DiscoveryFinding = Doc<"discoveryFindings">;

export function LaunchStep({ programId, onLaunch, onBack }: LaunchStepProps) {
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    requirements: number;
    risks: number;
    integrations: number;
    decisions: number;
  } | null>(null);

  const findings = useQuery(api.discoveryFindings.listByProgram, {
    programId: programId as Id<"programs">,
  }) as DiscoveryFinding[] | undefined;

  const importFindings = useMutation(api.discoveryFindings.importApprovedFindings);

  // Program details and source control hooks for repo provisioning
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const program = useQuery(api.programs.get, { programId: programId as Id<"programs"> });
  const installations = useQuery(
    api.sourceControl.installations.listByOrg,
    orgId ? { orgId } : "skip",
  );
  const hasActiveInstallation = installations?.some((i: any) => i.status === "active");
  const activeInstallation = installations?.find((i: any) => i.status === "active");

  const isLoading = findings === undefined;

  // Count approved + edited findings by type
  const counts = useMemo(() => {
    if (!findings) return { requirements: 0, risks: 0, integrations: 0, decisions: 0 };
    const importable = findings.filter(
      (f: DiscoveryFinding) => f.status === "approved" || f.status === "edited",
    );
    return {
      requirements: importable.filter((f: DiscoveryFinding) => f.type === "requirement").length,
      risks: importable.filter((f: DiscoveryFinding) => f.type === "risk").length,
      integrations: importable.filter((f: DiscoveryFinding) => f.type === "integration").length,
      decisions: importable.filter((f: DiscoveryFinding) => f.type === "decision").length,
    };
  }, [findings]);

  const totalImportable =
    counts.requirements + counts.risks + counts.integrations + counts.decisions;

  const handleLaunch = async () => {
    setImporting(true);
    try {
      const result = await importFindings({
        programId: programId as Id<"programs">,
      });
      setImportResult(result);
      // Navigate after a brief pause to show success
      setTimeout(onLaunch, 1500);
    } catch {
      setImporting(false);
    }
  };

  const summaryItems = [
    {
      label: "Requirements",
      count: counts.requirements,
      color: "text-accent-default",
      bg: "bg-status-info-bg",
    },
    {
      label: "Risks",
      count: counts.risks,
      color: "text-status-warning-fg",
      bg: "bg-status-warning-bg",
    },
    {
      label: "Integrations",
      count: counts.integrations,
      color: "text-status-success-fg",
      bg: "bg-status-success-bg",
    },
    {
      label: "Decisions",
      count: counts.decisions,
      color: "text-status-success-fg",
      bg: "bg-status-success-bg",
    },
  ];

  return (
    <div className="rounded-xl border border-border-default bg-surface-default p-6">
      <h2 className="mb-1 text-lg font-semibold text-text-heading">Launch Program</h2>
      <p className="mb-6 text-sm text-text-secondary">Review your program summary and launch.</p>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-text-secondary">Loading summary...</div>
      ) : importResult ? (
        /* Success state */
        <div className="rounded-lg border border-status-success-border bg-status-success-bg p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-status-success-bg">
            <svg
              className="h-6 w-6 text-status-success-fg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-status-success-fg">Program Launched!</h3>
          <p className="mt-1 text-sm text-status-success-fg">
            Imported {importResult.requirements} requirements, {importResult.risks} risks,{" "}
            {importResult.integrations} integrations, {importResult.decisions} decisions.
          </p>
          <p className="mt-2 text-xs text-status-success-fg">Redirecting to Mission Control...</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            {summaryItems.map((item) => (
              <div key={item.label} className={`rounded-lg ${item.bg} p-4 text-center`}>
                <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                <p className="mt-0.5 text-xs font-medium text-text-secondary">{item.label}</p>
              </div>
            ))}
          </div>

          {totalImportable === 0 && (
            <div className="mb-6 rounded-lg border border-dashed border-border-default p-4 text-center">
              <p className="text-sm text-text-secondary">
                No approved findings to import. Go back to review and approve findings, or launch
                with an empty program.
              </p>
            </div>
          )}

          {/* Repository Setup — shown for Salesforce programs (tech stack or legacy targetPlatform) with GitHub App */}
          {(program?.targetPlatform === "salesforce_b2b" ||
            ((program as any)?.techStack ?? []).some(
              (e: any) =>
                e.category === "commerce_platform" &&
                e.technologies?.some((t: string) => t.toLowerCase().includes("salesforce")),
            )) &&
            hasActiveInstallation &&
            activeInstallation && (
              <div className="mb-6 rounded-lg border border-border-default bg-surface-raised p-4">
                <ProvisionFromTemplate
                  programId={programId as Id<"programs">}
                  clientName={program.clientName ?? program.name}
                  installationId={activeInstallation.installationId}
                  owner={activeInstallation.accountLogin}
                  templateRepoFullName="Architect-And-Bot/sf-b2b-commerce-template"
                />
              </div>
            )}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleLaunch}
              disabled={importing}
              className="rounded-lg bg-accent-default px-6 py-2 text-sm font-bold text-text-on-brand hover:bg-accent-strong disabled:opacity-50"
            >
              {importing ? "Launching..." : "Launch Program"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
