"use client";

import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { RequirementsPage } from "./RequirementsPage";

interface ProgramBySlugResult {
  _id: string;
  slug?: string;
}

const KNOWN_ROOTS = new Set(["programs", "sandboxes", "sign-in", "sign-up"]);

function getProgramSlugFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const candidate = segments[0];
  if (!candidate || KNOWN_ROOTS.has(candidate)) {
    return null;
  }
  return candidate;
}

export function ProgramRequirementsRoute() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const programSlug = getProgramSlugFromPath(pathname);

  const program = useQuery(
    "programs:getBySlug" as any,
    isAuthenticated && orgId && programSlug ? { orgId, slug: programSlug } : "skip",
  ) as ProgramBySlugResult | null | undefined;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  if (!isAuthenticated || !orgId || !programSlug) {
    return (
      <div className="card rounded-xl p-8">
        <h1 className="type-display-m text-text-heading">Requirements</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Sign in and select a program to view requirements.
        </p>
      </div>
    );
  }

  if (program === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  if (program === null) {
    return (
      <div className="card rounded-xl p-8">
        <h1 className="type-display-m text-text-heading">Requirements</h1>
        <p className="mt-2 text-sm text-text-secondary">Program not found.</p>
      </div>
    );
  }

  return <RequirementsPage />;
}
