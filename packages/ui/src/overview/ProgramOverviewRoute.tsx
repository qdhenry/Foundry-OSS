"use client";

import { useProgramContext } from "../programs/ProgramContext";
import { OverviewPage } from "./OverviewPage";

export function ProgramOverviewRoute() {
  const { program, programId, slug } = useProgramContext();

  return <OverviewPage program={program} programId={String(programId)} programSlug={slug} />;
}
