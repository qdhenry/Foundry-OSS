"use client";

import {
  ProgramProvider as SharedProgramProvider,
  useProgramContext as useSharedProgramContext,
} from "@foundry/ui/programs";
import type { ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export interface ProgramData {
  _id: Id<"programs">;
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
  programId: Id<"programs">;
  slug: string;
}

export function ProgramProvider({ slug, children }: { slug: string; children: ReactNode }) {
  return <SharedProgramProvider slug={slug}>{children}</SharedProgramProvider>;
}

export const useProgramContext = useSharedProgramContext as unknown as () => ProgramContextType;
