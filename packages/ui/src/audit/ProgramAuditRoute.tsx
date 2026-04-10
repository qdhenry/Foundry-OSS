"use client";

import { AuditPage } from "./AuditPage";

interface ProgramContextValue {
  programId: string;
}

export interface ProgramAuditRouteProps {
  useProgramContext: () => ProgramContextValue;
}

export function ProgramAuditRoute({ useProgramContext }: ProgramAuditRouteProps) {
  const { programId } = useProgramContext();
  return <AuditPage programId={String(programId)} />;
}
