"use client";

import { useSearchParams } from "next/navigation";
import { ProgramWizard } from "@/components/programs/ProgramWizard";

export default function NewProgramPage() {
  const searchParams = useSearchParams();
  const resumeProgramId = searchParams.get("resume") ?? undefined;

  return (
    <div className="mx-auto container">
      <ProgramWizard resumeProgramId={resumeProgramId} />
    </div>
  );
}
