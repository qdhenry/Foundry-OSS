import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const AgentSchema = z.object({
  name: z.string(),
  description: z.string(),
  role: z.string().transform((v) =>
    v
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z_]/g, ""),
  ),
  model: z.string().optional().default("claude-sonnet-4-5-20250929"),
  tools: z.array(z.string()).optional().default([]),
  systemPrompt: z.string().optional().default(""),
  constraints: z.array(z.string()).optional().default([]),
  specializations: z.array(z.string()).optional().default([]),
});

const TeamProposalSchema = z
  .object({
    rationale: z.string().optional().default(""),
    coverage: z.array(z.string()).optional().default([]),
    roster: z.array(AgentSchema).optional(),
    agents: z.array(AgentSchema).optional(),
    team: z.array(AgentSchema).optional(),
  })
  .transform((data) => ({
    rationale: data.rationale,
    coverage: data.coverage,
    roster: data.roster ?? data.agents ?? data.team ?? [],
  }));

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const orgId = req.headers["x-org-id"] as string;
    const { program, workstreams, skills, requirements, customContext, targetAgentCount } =
      req.body;

    if (!program?.name) {
      res.status(400).json({
        error: { code: "MISSING_PROGRAM", message: "program is required" },
      });
      return;
    }

    const prompt = `Generate an AI agent team roster for this program.

Program: ${JSON.stringify(program)}
Workstreams: ${JSON.stringify(workstreams ?? [])}
Skills: ${JSON.stringify(skills ?? [])}
Requirements (sample): ${JSON.stringify(requirements ?? [])}
${customContext ? `Custom context: ${customContext}` : ""}
${targetAgentCount ? `Target agent count: ${targetAgentCount}` : ""}

Return JSON with a "roster" array of agents. Each agent needs: name, description, role (one of: architect, backend_engineer, frontend_engineer, fullstack_engineer, qa_engineer, devops, reviewer, project_manager, integration_specialist, orchestrator), model, tools, systemPrompt, constraints, specializations.`;

    const systemPrompt = `You are an expert AI engineering manager creating software delivery agent teams.
Organization: ${orgId ?? "unknown"}

Output valid JSON with a "roster" key containing an array of agents.
Rules:
- Keep tools list concise and realistic per role.
- Use strong, role-specific system prompts.
- Ensure coverage spans architecture, implementation, QA, and delivery management.
- Prefer 4-8 agents unless targetAgentCount is provided.
- Include a "rationale" string and "coverage" array alongside the roster.`;

    const result = await runAgentQuery(TeamProposalSchema, {
      prompt,
      systemPrompt,
      maxThinkingTokens: 8000,
    });

    res.json({
      ...result.data,
      metadata: result.metadata,
    });
  } catch (error) {
    next(error);
  }
});

export { router as generateTeamRouter };
