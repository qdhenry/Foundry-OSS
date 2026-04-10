"use client";

import { ChevronRight, Home01 } from "@untitledui/icons";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const segmentNames: Record<string, string> = {
  programs: "Programs",
  discovery: "Discovery",
  requirements: "Requirements",
  workstreams: "Workstreams",
  sprints: "Sprints",
  tasks: "Tasks",
  skills: "Skills",
  risks: "Risks",
  gates: "Gates",
  integrations: "Integrations",
  playbooks: "Playbooks",
  patterns: "Patterns",
  activity: "Activity",
  audit: "Audit Log",
  settings: "Settings",
  videos: "Videos",
  documents: "Documents",
  utilities: "Utilities",
  "mission-control": "Mission Control",
  "code-analyzer": "Code Analyzer",
  design: "Design System",
  "pipeline-lab": "Pipeline Lab",
  "sandbox-settings": "Sandbox Settings",
  new: "New",
  edit: "Edit",
};

/** Segments that contain a dynamic ID as the next segment */
const dynamicParents = new Set(["sprints", "skills", "workstreams", "risks"]);

/** Segments that look like dynamic IDs but are actually static routes (e.g. /skills/new) */
const staticSubRoutes = new Set(["new", "edit", "settings"]);

function DynamicSegmentLabel({ parentSegment, id }: { parentSegment: string; id: string }) {
  const queryMap: Record<string, string> = {
    sprints: "sprints:get",
    skills: "skills:get",
    workstreams: "workstreams:get",
    risks: "risks:get",
  };
  const argMap: Record<string, string> = {
    sprints: "sprintId",
    skills: "skillId",
    workstreams: "workstreamId",
    risks: "riskId",
  };

  const queryName = queryMap[parentSegment];
  const argKey = argMap[parentSegment];

  const record = useQuery(
    queryName as any,
    queryName && argKey ? { [argKey]: id as any } : "skip",
  ) as { name?: string; title?: string; number?: number } | null | undefined;

  if (record === undefined) return <span className="font-medium text-text-primary">...</span>;
  if (record === null) return <span className="font-medium text-text-primary">{id}</span>;

  const displayName =
    record.name ??
    record.title ??
    (record.number != null
      ? `${parentSegment === "sprints" ? "Sprint" : ""} #${record.number}`
      : id);

  return <span className="font-medium text-text-primary">{displayName}</span>;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className="flex items-center text-sm text-text-muted">
        <Home01 size={16} className="text-text-muted" />
        <ChevronRight size={14} className="mx-1 text-text-muted" />
        <span className="font-medium text-text-primary">Dashboard</span>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-text-muted">
      <Link href="/" className="text-text-muted hover:text-text-primary">
        <Home01 size={16} />
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;
        const prevSegment = index > 0 ? segments[index - 1] : undefined;
        const isDynamicId =
          prevSegment &&
          dynamicParents.has(prevSegment) &&
          !segmentNames[segment] &&
          !staticSubRoutes.has(segment);

        return (
          <span key={href} className="flex items-center">
            <ChevronRight size={14} className="mx-1 text-text-muted" />
            {isLast ? (
              isDynamicId && prevSegment ? (
                <DynamicSegmentLabel parentSegment={prevSegment} id={segment} />
              ) : (
                <span className="font-medium text-text-primary">
                  {segmentNames[segment] || segment}
                </span>
              )
            ) : (
              <Link href={href} className="hover:text-text-primary">
                {isDynamicId && prevSegment ? (
                  <DynamicSegmentLabel parentSegment={prevSegment} id={segment} />
                ) : (
                  segmentNames[segment] || segment
                )}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
