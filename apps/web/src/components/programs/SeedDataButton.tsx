"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

export function SeedDataButton({ orgId }: { orgId: string }) {
  const seedMutation = useMutation(api.seed.seedAcmeCorp);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSeed() {
    setStatus("loading");
    setErrorMessage("");
    try {
      await seedMutation({ orgId });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to seed data");
    }
  }

  if (status === "success") {
    return (
      <p className="text-sm text-status-success-fg">
        Demo data loaded successfully. Refresh to see AcmeCorp.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSeed}
        disabled={status === "loading"}
        className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover disabled:opacity-50"
      >
        {status === "loading" ? "Loading demo data..." : "Load Demo Data (AcmeCorp)"}
      </button>
      {status === "error" && <p className="text-sm text-status-error-fg">{errorMessage}</p>}
    </div>
  );
}
