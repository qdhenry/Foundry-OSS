"use client";

import { TasksPage } from "@foundry/ui";
import { useProgramContext } from "../../../../lib/programContext";

export default function ProgramTasksPage() {
  const { programId, slug } = useProgramContext();
  const programSlug = slug || String(programId);

  return <TasksPage programId={String(programId)} programSlug={programSlug} />;
}
