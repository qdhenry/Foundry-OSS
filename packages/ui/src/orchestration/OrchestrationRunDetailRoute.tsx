"use client";

import { useParams } from "next/navigation";
import { useProgramContext } from "../programs";
import { OrchestrationRunDetail } from "./OrchestrationRunDetail";

export function OrchestrationRunDetailRoute() {
  const { programId } = useProgramContext();
  const params = useParams();
  const runId = params?.runId as string;
  if (!runId) return null;
  return <OrchestrationRunDetail programId={programId} runId={runId} />;
}
