import { Hono } from "hono";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service";
import type { Env } from "../types";

const AssignmentSchema = z.object({
  taskId: z.string(),
  agentId: z.string(),
  executionMode: z
    .string()
    .transform((v) => v.toLowerCase().replace(/[\s-]+/g, "_"))
    .pipe(z.enum(["sandbox", "sdk"])),
  confidence: z.number().min(0).max(100).optional().default(50),
  branchName: z.string(),
  estimatedTokens: z.number().optional().default(50000),
  rationale: z.string().optional().default(""),
  repositoryId: z.string().optional(),
});

const PlanResponseSchema = z
  .object({
    assignments: z.array(AssignmentSchema).optional(),
    plan: z.array(AssignmentSchema).optional(),
    task_assignments: z.array(AssignmentSchema).optional(),
  })
  .transform((data) => ({
    assignments: data.assignments ?? data.plan ?? data.task_assignments ?? [],
  }));

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const { tasks, agents, repositories, branchStrategy, branchPattern } = await c.req.json();
  const orgId = c.req.header("x-org-id") ?? "unknown";

  if (!tasks?.length) {
    return c.json(
      {
        error: { code: "MISSING_TASKS", message: "tasks array is required and must not be empty" },
      },
      400,
    );
  }

  if (!agents?.length) {
    return c.json(
      {
        error: {
          code: "MISSING_AGENTS",
          message: "agents array is required and must not be empty",
        },
      },
      400,
    );
  }

  const prompt = `You are assigning AI agents to software delivery tasks. Match each task to the best agent based on role alignment and specialization.

Tasks to assign:
${JSON.stringify(tasks, null, 2)}

Available agents:
${JSON.stringify(agents, null, 2)}

Repository IDs available: ${JSON.stringify(repositories ?? [])}
Branch strategy: ${branchStrategy ?? "per_task"}
${branchPattern ? `Branch pattern: ${branchPattern}` : ""}

For each task, produce an assignment with:
- taskId: the task's id
- agentId: the assigned agent's id
- executionMode: "sandbox" for implementation/coding tasks, "sdk" for analysis/review/planning tasks
- confidence: 0-100 score for how well the agent fits the task
- branchName: a git branch name following the branch strategy (e.g., "feat/<task-slug>" for per_task, "agent/<agent-name>" for per_agent)
- estimatedTokens: estimated total token usage for completing this task (typically 30000-150000)
- rationale: brief explanation of why this agent was chosen
- repositoryId: which repository to target (from the available list), if applicable

Rules:
- Every task must be assigned to exactly one agent.
- An agent can be assigned multiple tasks if needed, but prefer distribution.
- Match agent roles/specializations to task requirements.
- Architect agents handle design/planning tasks (sdk mode).
- Engineer agents handle implementation tasks (sandbox mode).
- QA agents handle testing/review tasks (sandbox or sdk mode).
- Estimate tokens conservatively — larger tasks need more tokens.

Return JSON with an "assignments" array.`;

  const systemPrompt = `You are an expert AI orchestration planner for software delivery teams.
Organization: ${orgId}

Output valid JSON with an "assignments" key containing an array of task-to-agent assignments.
Be precise with branch names — use lowercase, hyphens, no spaces.
Ensure every task from the input is represented in the output assignments.`;

  const result = await runAgentQuery(
    PlanResponseSchema,
    {
      prompt,
      systemPrompt,
      maxThinkingTokens: 8000,
    },
    c.env.ANTHROPIC_API_KEY,
  );

  return c.json({
    ...result.data,
    metadata: result.metadata,
  });
});

export { app as planAssignmentsRoute };
