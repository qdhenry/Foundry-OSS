"use client";

import { useParams } from "next/navigation";
import { WorkstreamDetailPage } from "./WorkstreamDetailPage";

export function ProgramWorkstreamDetailRoute() {
  const params = useParams();
  const workstreamId = params.workstreamId;

  if (typeof workstreamId !== "string") {
    return (
      <div className="card rounded-xl p-8">
        <h1 className="type-display-m text-text-heading">Workstream</h1>
        <p className="mt-2 text-sm text-text-secondary">Select a workstream to load details.</p>
      </div>
    );
  }

  return <WorkstreamDetailPage workstreamId={workstreamId} />;
}
