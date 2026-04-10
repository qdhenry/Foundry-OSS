"use client";

import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useFadeIn, useStaggerEntrance } from "../theme/useAnimations";
import { PHASE_COLORS, PLATFORM_COLORS, PLATFORM_LABELS, STATUS_COLORS } from "./programStyles";

interface ProgramSummary {
  _id: string;
  slug?: string;
  name: string;
  clientName: string;
  targetPlatform: string;
  phase: string;
  status: string;
  setupStatus?: string;
}

function getProgramHref(program: ProgramSummary) {
  if (program.setupStatus && program.setupStatus !== "complete") {
    return `/programs/new?resume=${program._id}`;
  }

  return `/${program.slug ?? program._id}`;
}

function getMappedClass(mapping: Record<string, string>, key: string, fallback: string) {
  return mapping[key] ?? fallback;
}

export function ProgramsPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const gridRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const syncActiveOrg = useMutation("users:syncActiveOrg" as any);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (isAuthenticated && orgId && !hasSynced.current) {
      hasSynced.current = true;
      syncActiveOrg({ orgId }).catch(() => {});
    }
  }, [isAuthenticated, orgId, syncActiveOrg]);

  const programs = useQuery(
    "programs:list" as any,
    isAuthenticated && orgId ? { orgId } : "skip",
  ) as ProgramSummary[] | undefined;

  useStaggerEntrance(gridRef, ".animate-card");
  useFadeIn(contentRef, !!programs);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="card rounded-xl p-8">
        <h1 className="type-display-m text-text-heading">Programs</h1>
        <p className="mt-2 text-sm text-text-secondary">Sign in to load your programs.</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="card rounded-xl p-8">
        <h1 className="type-display-m text-text-heading">Programs</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Select an organization to load your programs.
        </p>
      </div>
    );
  }

  if (programs === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
      </div>
    );
  }

  return (
    <div ref={contentRef}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="type-display-m text-text-heading">Programs</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage your migration programs</p>
        </div>

        <Link href="/programs/new" className="btn-primary btn-sm">
          Create Program
        </Link>
      </div>

      {programs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center rounded-xl border-dashed py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-raised">
            <svg
              className="h-8 w-8 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-text-primary">No programs yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Create your first migration program to get started.
          </p>
          <Link href="/programs/new" className="btn-primary btn-sm mt-4">
            Create Program
          </Link>
        </div>
      ) : (
        <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <Link
              key={program._id}
              href={getProgramHref(program)}
              className="animate-card card card-interactive group rounded-xl p-5"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-default">
                  {program.name}
                </h3>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getMappedClass(
                    STATUS_COLORS,
                    program.status,
                    "bg-surface-raised text-text-secondary",
                  )}`}
                >
                  {program.status}
                </span>
                {program.setupStatus && program.setupStatus !== "complete" && (
                  <span className="badge badge-warning">Setup in progress</span>
                )}
              </div>

              <p className="mb-3 text-sm text-text-secondary">{program.clientName}</p>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getMappedClass(
                    PLATFORM_COLORS,
                    program.targetPlatform,
                    "bg-surface-raised text-text-secondary",
                  )}`}
                >
                  {PLATFORM_LABELS[program.targetPlatform] ?? program.targetPlatform}
                </span>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getMappedClass(
                    PHASE_COLORS,
                    program.phase,
                    "bg-surface-raised text-text-secondary",
                  )}`}
                >
                  {program.phase}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
