import { Hono } from "hono";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service";
import type { Env } from "../types";

const ChatResponseSchema = z.object({
  answer: z.string(),
  referencedNodeNames: z.array(z.string()),
});

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  const { question, graphContext, chatHistory } = await c.req.json();
  const orgId = c.req.header("x-org-id") ?? "unknown";

  if (!question) {
    return c.json({ error: { code: "MISSING_QUESTION", message: "question is required" } }, 400);
  }

  const systemPrompt = `You are a codebase exploration assistant. Answer questions about the analyzed codebase using the provided knowledge graph context.

Organization: ${orgId}

When referencing specific files, functions, or classes, include their names in the referencedNodeNames array so the UI can highlight them on the graph.

Be specific and cite actual file paths and function names from the knowledge graph. If the question can't be answered from the available context, say so clearly.

Respond with valid JSON matching the required schema.`;

  const historyStr = chatHistory
    ? (chatHistory as Array<{ role: string; content: string }>)
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
        .join("\n")
    : "";

  const prompt = `## Knowledge Graph Context
${JSON.stringify(graphContext ?? {}, null, 2)}

${historyStr ? `## Chat History\n${historyStr}\n` : ""}
## Question
${question}`;

  const result = await runAgentQuery(
    ChatResponseSchema,
    { prompt, systemPrompt },
    c.env.ANTHROPIC_API_KEY,
  );

  return c.json({
    answer: result.data.answer,
    referencedNodeNames: result.data.referencedNodeNames,
    metadata: result.metadata,
  });
});

export { app as codebaseChatRoute };
