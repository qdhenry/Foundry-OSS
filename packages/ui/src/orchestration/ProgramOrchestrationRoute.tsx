"use client";

import { useProgramContext } from "../programs";
import { OrchestrationRunsPage } from "./OrchestrationRunsPage";

export function ProgramOrchestrationRoute() {
  const { programId } = useProgramContext();
  return <OrchestrationRunsPage programId={programId} />;
}
