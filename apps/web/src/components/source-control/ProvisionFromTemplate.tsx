"use client";

import { useAction } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface ProvisionFromTemplateProps {
  programId: Id<"programs">;
  clientName: string;
  installationId: string;
  owner: string;
  templateRepoFullName: string;
  onSuccess?: (result: { repoUrl: string; repoFullName: string }) => void;
  onSkip?: () => void;
}

const ERP_OPTIONS = [
  { value: "Rootstock", label: "Rootstock" },
  { value: "NetSuite", label: "NetSuite" },
  { value: "SAP", label: "SAP" },
  { value: "None", label: "None" },
];

const CPQ_OPTIONS = [
  { value: "Logik.io", label: "Logik.io" },
  { value: "Salesforce CPQ", label: "Salesforce CPQ" },
  { value: "None", label: "None" },
];

const TAX_OPTIONS = [
  { value: "Avalara", label: "Avalara" },
  { value: "Vertex", label: "Vertex" },
  { value: "Native", label: "Native (Salesforce)" },
];

const PAYMENT_OPTIONS = [
  { value: "Stripe", label: "Stripe" },
  { value: "Adyen", label: "Adyen" },
  { value: "Authorize.net", label: "Authorize.net" },
];

export function ProvisionFromTemplate({
  programId,
  clientName,
  installationId,
  owner,
  templateRepoFullName,
  onSuccess,
  onSkip,
}: ProvisionFromTemplateProps) {
  const provisionAction = useAction(api.sourceControl.provisioning.provisionFromTemplate);

  // Auto-suggest values from client name
  const suggestedPrefix = useMemo(() => {
    return clientName
      .split(/[\s-_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");
  }, [clientName]);

  const suggestedRepoName = useMemo(() => {
    return `${clientName
      .toLowerCase()
      .replace(/[\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")}-sf-b2b`;
  }, [clientName]);

  const suggestedOrgAlias = useMemo(() => {
    return `${suggestedPrefix}DevHub`;
  }, [suggestedPrefix]);

  const suggestedScratchAlias = useMemo(() => {
    return `${suggestedPrefix}Dev`;
  }, [suggestedPrefix]);

  // Form state
  const [repoName, setRepoName] = useState(suggestedRepoName);
  const [projectPrefix, setProjectPrefix] = useState(suggestedPrefix);
  const [orgAlias, setOrgAlias] = useState(suggestedOrgAlias);
  const [scratchOrgAlias, setScratchOrgAlias] = useState(suggestedScratchAlias);
  const [isPrivate, setIsPrivate] = useState(true);
  const [erpSystem, setErpSystem] = useState("None");
  const [cpqSystem, setCpqSystem] = useState("None");
  const [taxSystem, setTaxSystem] = useState("Native");
  const [paymentGateway, setPaymentGateway] = useState("Stripe");

  // Progress state
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ repoUrl: string; repoFullName: string } | null>(null);

  const handleProvision = async () => {
    setError(null);
    setProvisioning(true);
    try {
      const res = await provisionAction({
        programId,
        installationId,
        owner,
        repoName,
        isPrivate,
        templateRepoFullName,
        variables: {
          projectPrefix,
          clientName,
          orgAlias,
          scratchOrgAlias,
          erpSystem,
          cpqSystem,
          taxSystem,
          paymentGateway,
        },
      });
      setResult({ repoUrl: res.repoUrl, repoFullName: res.repoFullName });
      onSuccess?.({ repoUrl: res.repoUrl, repoFullName: res.repoFullName });
    } catch (err: any) {
      setError(err.message ?? "Failed to provision repository");
    } finally {
      setProvisioning(false);
    }
  };

  if (result) {
    return (
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
        <h3 className="text-lg font-semibold text-status-success-fg">Repository Created</h3>
        <p className="mt-1 text-sm text-status-success-fg">
          {result.repoFullName} has been created and connected to your program.
        </p>
        <a
          href={result.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-status-success-fg underline hover:opacity-80"
        >
          Open on GitHub
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    );
  }

  const inputClass = "input";
  const labelClass = "form-label";
  const selectClass = "select";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-text-heading">Create Repository from Template</h3>
        <p className="mt-1 text-xs text-text-secondary">
          Provision a new Salesforce B2B Commerce repository pre-configured with project structure,
          Claude Code skills, and deployment scripts.
        </p>
      </div>

      {/* Repository basics */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="provision-repo-name" className={labelClass}>
            Repository Name
          </label>
          <input
            id="provision-repo-name"
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="acmeco-sf-b2b"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="provision-prefix" className={labelClass}>
            Project Prefix (PascalCase)
          </label>
          <input
            id="provision-prefix"
            type="text"
            value={projectPrefix}
            onChange={(e) => setProjectPrefix(e.target.value)}
            placeholder="AcmeCo"
            className={inputClass}
          />
        </div>
      </div>

      {/* SF Org aliases */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="provision-org-alias" className={labelClass}>
            DevHub Alias
          </label>
          <input
            id="provision-org-alias"
            type="text"
            value={orgAlias}
            onChange={(e) => setOrgAlias(e.target.value)}
            placeholder="AcmeDevHub"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="provision-scratch-alias" className={labelClass}>
            Scratch Org Alias
          </label>
          <input
            id="provision-scratch-alias"
            type="text"
            value={scratchOrgAlias}
            onChange={(e) => setScratchOrgAlias(e.target.value)}
            placeholder="AcmeDev"
            className={inputClass}
          />
        </div>
      </div>

      {/* Integration selections */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="provision-erp" className={labelClass}>
            ERP System
          </label>
          <select
            id="provision-erp"
            value={erpSystem}
            onChange={(e) => setErpSystem(e.target.value)}
            className={selectClass}
          >
            {ERP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="provision-cpq" className={labelClass}>
            CPQ System
          </label>
          <select
            id="provision-cpq"
            value={cpqSystem}
            onChange={(e) => setCpqSystem(e.target.value)}
            className={selectClass}
          >
            {CPQ_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="provision-tax" className={labelClass}>
            Tax System
          </label>
          <select
            id="provision-tax"
            value={taxSystem}
            onChange={(e) => setTaxSystem(e.target.value)}
            className={selectClass}
          >
            {TAX_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="provision-payment" className={labelClass}>
            Payment Gateway
          </label>
          <select
            id="provision-payment"
            value={paymentGateway}
            onChange={(e) => setPaymentGateway(e.target.value)}
            className={selectClass}
          >
            {PAYMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Visibility */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="rounded border-border-default text-accent-default focus:ring-accent-default"
          />
          Private repository
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-status-error-border bg-status-error-bg p-3">
          <p className="text-sm text-status-error-fg">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={provisioning}
            className="text-sm font-medium text-text-secondary hover:text-text-primary"
          >
            Skip — connect existing repo later
          </button>
        )}
        <button
          type="button"
          onClick={handleProvision}
          disabled={provisioning || !repoName.trim() || !projectPrefix.trim()}
          className="rounded-lg bg-accent-default px-6 py-2 text-sm font-bold text-text-on-brand hover:bg-accent-strong disabled:opacity-50"
        >
          {provisioning ? "Creating Repository..." : "Create Repository"}
        </button>
      </div>
    </div>
  );
}
