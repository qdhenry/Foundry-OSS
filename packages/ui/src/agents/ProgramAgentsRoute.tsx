"use client";

import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { AgentsPage } from "./AgentsPage";

interface ProgramBySlugResult {
  _id: string;
  slug?: string;
}

const KNOWN_ROOTS = new Set(["programs", "sandboxes", "sign-in", "sign-up"]);

function getProgramSlugFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[0];
  if (!candidate || KNOWN_ROOTS.has(candidate)) return null;
  return candidate;
}

export function ProgramAgentsRoute() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const programSlug = getProgramSlugFromPath(pathname);

  const program = useQuery(
    "programs:getBySlug" as any,
    isAuthenticated && orgId && programSlug ? { orgId, slug: programSlug } : "skip",
  ) as ProgramBySlugResult | null | undefined;

  if (isLoading || program === undefined) {
    return <div className="h-48 animate-pulse rounded-xl bg-surface-elevated" />;
  }

  if (!isAuthenticated || !orgId || !programSlug || program === null) {
    return (
      <div className="card rounded-xl p-6">
        <h1 className="text-xl font-semibold text-text-heading">Agent Team</h1>
        <p className="mt-2 text-sm text-text-secondary">Select a valid program to manage agents.</p>
      </div>
    );
  }

  return <AgentsPage programId={String(program._id)} />;
}
