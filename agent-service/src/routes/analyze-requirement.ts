import { Router } from "express";
import { z } from "zod";
import { runAgentQuery } from "../lib/ai-service.js";

const EvidenceFileSchema = z.object({
  filePath: z.string(),
  lineStart: z.number().optional(),
  lineEnd: z.number().optional(),
  snippet: z.string().optional(),
  relevance: z.string(),
});

const AnalysisResultSchema = z.object({
  implementationStatus: z.enum([
    "not_found",
    "partially_implemented",
    "fully_implemented",
    "needs_verification",
  ]),
  confidence: z.number().min(0).max(100),
  confidenceReasoning: z.string(),
  evidence: z.object({
    files: z.array(EvidenceFileSchema),
  }),
  gapDescription: z.string().optional(),
});

const MODEL_BY_TIER: Record<string, string> = {
  fast: "claude-sonnet-4-5-20250929",
  standard: "claude-sonnet-4-5-20250929",
  thorough: "claude-opus-4-6",
};

const THINKING_BY_TIER: Record<string, number | undefined> = {
  fast: undefined,
  standard: 4000,
  thorough: 8000,
};

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const {
      requirementId,
      requirementText,
      requirementDescription,
      acceptanceCriteria,
      candidateFiles,
      knowledgeGraphNodes,
      semanticMatches,
      config,
    } = req.body;

    if (!requirementText) {
      res.status(400).json({
        error: { code: "MISSING_REQUIREMENT", message: "requirementText is required" },
      });
      return;
    }

    const tier = config?.modelTier ?? "standard";
    const model = MODEL_BY_TIER[tier] ?? MODEL_BY_TIER.standard;
    const thinkingTokens = THINKING_BY_TIER[tier];

    const criteriaBlock =
      acceptanceCriteria && acceptanceCriteria.length > 0
        ? `\n\nAcceptance Criteria:\n${acceptanceCriteria.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n")}`
        : "";

    const filesBlock =
      candidateFiles && candidateFiles.length > 0
        ? candidateFiles
            .map(
              (f: { repoId: string; path: string; content: string }) =>
                `--- ${f.path} (repo: ${f.repoId}) ---\n${f.content}`,
            )
            .join("\n\n")
        : "No candidate files were found via code search.";

    const graphBlock =
      knowledgeGraphNodes && knowledgeGraphNodes.length > 0
        ? `\n\nKnowledge Graph Nodes (from prior analysis):\n${knowledgeGraphNodes
            .map(
              (n: { name: string; layer: string; filePath: string }) =>
                `- ${n.name} [${n.layer}] → ${n.filePath}`,
            )
            .join("\n")}`
        : "";

    const semanticBlock =
      semanticMatches && semanticMatches.length > 0
        ? `\n\nSemantic Matches (ranked by relevance to this requirement):\n${semanticMatches
            .map(
              (m: {
                name: string;
                type: string;
                filePath: string;
                signature: string;
                docstring?: string;
                similarity: number;
              }) =>
                `- ${m.type} ${m.name} (${m.similarity}% match) → ${m.filePath}\n  Signature: ${m.signature}${m.docstring ? `\n  Doc: ${m.docstring}` : ""}`,
            )
            .join("\n")}`
        : "";

    const systemPrompt = `You are an expert code analyst. Your job is to determine whether a software requirement is implemented in the provided codebase files.

Analyze the requirement against the source code and produce a JSON assessment with:
- implementationStatus: one of "fully_implemented", "partially_implemented", "not_found", or "needs_verification"
- confidence: 0-100 score reflecting your certainty
- confidenceReasoning: brief explanation of why you assigned this status and confidence
- evidence.files: array of files that support your assessment (filePath, lineStart, lineEnd, snippet of max 500 chars, relevance description)
- gapDescription: if partially implemented or needs verification, describe what's missing

Guidelines:
- "fully_implemented" = all aspects of the requirement are clearly present in code
- "partially_implemented" = some aspects exist but the requirement isn't fully satisfied
- "not_found" = no meaningful code matches this requirement
- "needs_verification" = code exists that might satisfy this requirement but you can't be certain
- Be conservative with confidence — if you're unsure, lower the score
- Include file evidence even for "not_found" if you found tangentially related code
- Keep snippets under 500 characters — show the most relevant section
- When semantic matches are provided, use them as strong signals for where to look — higher similarity scores indicate stronger relevance

Respond with valid JSON matching the required schema. No markdown fences.`;

    const prompt = `Analyze whether this requirement is implemented in the codebase.

## Requirement
ID: ${requirementId ?? "unknown"}
Title: ${requirementText}
${requirementDescription ? `Description: ${requirementDescription}` : ""}${criteriaBlock}
${graphBlock}${semanticBlock}

## Source Code Files (${candidateFiles?.length ?? 0} files)
${filesBlock}

Produce your analysis as JSON.`;

    const result = await runAgentQuery(AnalysisResultSchema, {
      prompt,
      systemPrompt,
      model,
      ...(thinkingTokens && { maxThinkingTokens: thinkingTokens }),
    });

    res.json({
      ...result.data,
      metadata: result.metadata,
    });
  } catch (err) {
    next(err);
  }
});

export { router as analyzeRequirementRouter };
