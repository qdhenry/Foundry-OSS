"use client";

import { useParams } from "next/navigation";
import { PresenceBar } from "@/components/shared/PresenceBar";
import { ProgramProvider } from "@/lib/programContext";

export default function ProgramLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.programId as string;

  return (
    <ProgramProvider slug={slug}>
      <div className="space-y-4">
        <PresenceBar />
        {children}
      </div>
    </ProgramProvider>
  );
}
