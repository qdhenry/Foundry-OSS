"use client";

import { ProgramAuditRoute } from "@foundry/ui/audit";
import { useProgramContext } from "../../../../lib/programContext";

export default function AuditPage() {
  return <ProgramAuditRoute useProgramContext={useProgramContext} />;
}
