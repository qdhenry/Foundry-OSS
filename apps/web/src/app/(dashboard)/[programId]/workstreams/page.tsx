"use client";

import { WorkstreamsPage } from "@foundry/ui";
import { useProgramContext } from "../../../../lib/programContext";

export default function ProgramWorkstreamsPage() {
  const { programId, slug } = useProgramContext();
  const programSlug = slug || String(programId);

  return <WorkstreamsPage programId={String(programId)} programSlug={programSlug} />;
}
