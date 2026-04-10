import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const ChatResponseSchema = z.object({
  answer: z.string(),
  referencedNodeNames: z.array(z.string()),
});

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { question, graphContext, chatHistory } = req.body;
    const orgId = req.headers["x-org-id"] as string;

    if (!question) {
      res
        .status(400)
        .json({ error: { code: "MISSING_QUESTION", message: "question is required" } });
      return;
    }

    const systemPrompt = `You are a codebase exploration assistant. Answer questions about the analyzed codebase using the provided knowledge graph context.

Organization: ${orgId ?? "unknown"}

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

    const result = await runAgentQuery(ChatResponseSchema, { prompt, systemPrompt });

    res.json({
      answer: result.data.answer,
      referencedNodeNames: result.data.referencedNodeNames,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as codebaseChatRouter };
