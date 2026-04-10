"use node";

import { ConvexError, v } from "convex/values";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require("../_generated/api") as { api: any };

import { action } from "../_generated/server";
import { callAgentService } from "../lib/agentServiceClient";

interface TeamProposalAgent {
  name: string;
  description: string;
  role:
    | "architect"
    | "backend_engineer"
    | "frontend_engineer"
    | "fullstack_engineer"
    | "qa_engineer"
    | "devops"
    | "reviewer"
    | "project_manager"
    | "integration_specialist"
    | "orchestrator";
  model: "claude-opus-4-6" | "claude-sonnet-4-5-20250929" | "claude-sonnet-4-5-20250514";
  tools: string[];
  systemPrompt: string;
  constraints: string[];
  specializations: string[];
}

export const generateTeamProposal = action({
  args: {
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
    customContext: v.optional(v.string()),
    targetAgentCount: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    proposal: { roster: TeamProposalAgent[]; rationale: string; coverage: string[] };
    generatedAt: number;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    // Cast runQuery to break circular type instantiation (TS2589)
    const runQ = ctx.runQuery as any;

    const program: any = await runQ(api.programs.get, {
      programId: args.programId,
    });

    if (!program) {
      throw new Error("Program not found");
    }

    if (program.orgId !== args.orgId) {
      throw new ConvexError("Access denied");
    }

    const allWorkstreams: any[] = await runQ(api.workstreams.listByProgram, {
      programId: args.programId,
    });

    const selectedWorkstreams = args.workstreamIds
      ? allWorkstreams.filter((workstream: any) => args.workstreamIds?.includes(workstream._id))
      : allWorkstreams;

    const skills: any[] = await runQ(api.skills.listByProgram, {
      programId: args.programId,
    });

    const requirements: any[] = await runQ(api.requirements.listByProgram, {
      programId: args.programId,
    });

    const response = await callAgentService<{
      roster: TeamProposalAgent[];
      rationale: string;
      coverage: string[];
    }>({
      endpoint: "/generate-team",
      orgId: args.orgId,
      body: {
        program: {
          id: program._id,
          name: program.name,
          description: program.description,
          clientName: program.clientName,
          phase: program.phase,
        },
        workstreams: selectedWorkstreams.map((workstream: any) => ({
          id: workstream._id,
          name: workstream.name,
          description: workstream.description,
          status: workstream.status,
        })),
        skills: skills.map((skill: any) => ({
          id: skill._id,
          name: skill.name,
          domain: skill.domain,
          status: skill.status,
        })),
        requirements: requirements.slice(0, 150).map((requirement: any) => ({
          id: requirement._id,
          title: requirement.title,
          priority: requirement.priority,
          status: requirement.status,
          workstreamId: requirement.workstreamId,
        })),
        customContext: args.customContext,
        targetAgentCount: args.targetAgentCount,
      },
      timeoutMs: 180_000,
    });

    return {
      proposal: response,
      generatedAt: Date.now(),
    };
  },
});
