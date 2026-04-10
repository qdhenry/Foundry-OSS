"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useProgramContext } from "../programs";
import { VisualDiscoveryGallery } from "./VisualDiscoveryGallery";

export function VideosPage() {
  const { programId, slug } = useProgramContext();

  const analyses = useQuery(
    "videoAnalysis:listByProgram" as any,
    programId ? { programId } : "skip",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Visual Discovery</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Explore keyframes, context windows, and linked findings from analyzed call recordings.
          </p>
        </div>
        <Link
          href={`/${slug}/videos/upload`}
          className="btn-primary btn-sm inline-flex items-center gap-2"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          Upload Video
        </Link>
      </div>

      <VisualDiscoveryGallery programId={String(programId)} analyses={analyses as any} />
    </div>
  );
}

export default VideosPage;
