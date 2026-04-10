/**
 * Mock ProgramProvider for Storybook page stories.
 * Replaces the real ProgramProvider which depends on Convex queries.
 * Provides static AcmeCorp data via React context.
 */
import React, { createContext, useContext, type ReactNode } from "react";
import { MOCK_PROGRAM } from "./convex";

interface ProgramData {
  _id: any;
  _creationTime: number;
  orgId: string;
  name: string;
  clientName: string;
  sourcePlatform: string;
  targetPlatform: string;
  phase: string;
  status: string;
  startDate?: number;
  targetEndDate?: number;
  description?: string;
  stats: {
    totalRequirements: number;
    completedRequirements: number;
    completionPercent: number;
    workstreamCount: number;
    riskCount: number;
    agentExecutionCount: number;
  };
}

interface ProgramContextType {
  program: ProgramData;
  programId: any;
}

const ProgramContext = createContext<ProgramContextType | undefined>(undefined);

export function ProgramProvider({
  programId,
  children,
}: {
  programId?: any;
  children: ReactNode;
}) {
  const id = programId ?? MOCK_PROGRAM._id;
  return (
    <ProgramContext.Provider value={{ program: MOCK_PROGRAM as ProgramData, programId: id }}>
      {children}
    </ProgramContext.Provider>
  );
}

export function useProgramContext() {
  const context = useContext(ProgramContext);
  if (!context) {
    // Return default mock data instead of throwing in Storybook
    return { program: MOCK_PROGRAM as ProgramData, programId: MOCK_PROGRAM._id };
  }
  return context;
}
