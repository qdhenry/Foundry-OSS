"use client";

import { useOrganization } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";
import type { GenericId } from "convex/values";
import { createContext, type ReactNode, useContext } from "react";

export interface ProgramData {
  _id: GenericId<"programs">;
  _creationTime: number;
  orgId: string;
  name: string;
  clientName: string;
  sourcePlatform:
    | "magento"
    | "salesforce_b2b"
    | "bigcommerce_b2b"
    | "sitecore"
    | "wordpress"
    | "none";
  targetPlatform:
    | "magento"
    | "salesforce_b2b"
    | "bigcommerce_b2b"
    | "sitecore"
    | "wordpress"
    | "none";
  phase: "discovery" | "build" | "test" | "deploy" | "complete";
  status: "active" | "paused" | "complete" | "archived";
  startDate?: number;
  targetEndDate?: number;
  description?: string;
  slug?: string;
  stats: {
    totalRequirements: number;
    completedRequirements: number;
    completionPercent: number;
    workstreamCount: number;
    riskCount: number;
    agentExecutionCount: number;
  };
}

export interface ProgramContextType {
  program: ProgramData;
  programId: GenericId<"programs">;
  slug: string;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const program = useQuery(
    "programs:getBySlug" as any,
    isAuthenticated && orgId ? { orgId, slug } : "skip",
  ) as ProgramData | null | undefined;

  if (program === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-accent-default" />
          <p className="text-sm text-text-secondary">Loading program...</p>
        </div>
      </div>
    );
  }

  if (program === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-text-heading">Program not found</p>
          <p className="mt-1 text-sm text-text-secondary">
            This program may have been deleted or you don&apos;t have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ProgramContext.Provider
      value={{
        program,
        programId: program._id,
        slug: program.slug ?? program._id,
      }}
    >
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgramContext() {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error("useProgramContext must be used within a ProgramProvider");
  }
  return context;
}
