import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { withRetry } from "../../convex/ai/retry";
import { createAuditHook, createCostTrackingHook } from "./hooks";
import { mcpTools } from "./mcp-tools";
import { buildAnalysisSystemPrompt } from "./prompts";
import { DocumentAnalysisResult, type DocumentAnalysisResultType } from "./schemas";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = parseInt(process.env.AGENT_SERVICE_PORT ?? "3001", 10);

interface AnalyzeRequest {
  analysisId: string;
  documentId: string;
  programId: string;
  orgId: string;
  extractedText: string;
  mimeType?: string;
  fileName: string;
  targetPlatform: "salesforce_b2b" | "bigcommerce_b2b";
}

interface AnalysisUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

async function runAnalysis(params: AnalyzeRequest): Promise<{
  result: DocumentAnalysisResultType;
  usage: AnalysisUsage;
  durationMs: number;
  modelId: string;
}> {
  const startTime = Date.now();

  // Set up hooks
  const auditHook = createAuditHook(params.analysisId);
  const costHook = createCostTrackingHook();

  // 1. Fetch context from Convex via MCP tools
  const toolStart = Date.now();

  const [programContext, workstreams, existingTitles] = await Promise.all([
    mcpTools.getProgramContext.execute({ programId: params.programId }),
    mcpTools.getWorkstreams.execute({ programId: params.programId }),
    mcpTools.getExistingRequirements.execute({ programId: params.programId }),
  ]);

  auditHook.onToolUse({
    toolName: "getProgramContext",
    input: { programId: params.programId },
    output: programContext,
    durationMs: Date.now() - toolStart,
  });
  auditHook.onToolUse({
    toolName: "getWorkstreams",
    input: { programId: params.programId },
    output: workstreams,
    durationMs: Date.now() - toolStart,
  });
  auditHook.onToolUse({
    toolName: "getExistingRequirements",
    input: { programId: params.programId },
    output: existingTitles,
    durationMs: Date.now() - toolStart,
  });

  // 2. Build system prompt with full context
  const systemPrompt = buildAnalysisSystemPrompt({
    targetPlatform: params.targetPlatform,
    workstreams: workstreams.map((ws: any) => ({
      shortCode: ws.shortCode,
      name: ws.name,
      description: ws.description,
    })),
    existingRequirementTitles: existingTitles as string[],
  });

  // 3. Build user prompt with document content
  const userPrompt = [
    "Analyze the following document and extract structured findings.",
    "",
    "<document>",
    `<file-name>${params.fileName}</file-name>`,
    `<mime-type>${params.mimeType ?? "text/plain"}</mime-type>`,
    "<content>",
    params.extractedText,
    "</content>",
    "</document>",
  ].join("\n");

  // 4. Call Claude API with structured output
  const client = new Anthropic();
  const modelId = "claude-sonnet-4-5-20250929";

  const response = await client.messages.create({
    model: modelId,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const durationMs = Date.now() - startTime;

  // Track cost
  costHook.onResponse({
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: (response.usage as any).cache_read_input_tokens ?? 0,
    cacheCreationTokens: (response.usage as any).cache_creation_input_tokens ?? 0,
    modelId,
  });

  // 5. Parse and validate the response
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  // Extract JSON from the response (may be wrapped in markdown code blocks)
  let jsonText = textBlock.text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonText);
  const result = DocumentAnalysisResult.parse(parsed);

  const costTotals = costHook.getTotals();

  return {
    result,
    usage: {
      inputTokens: costTotals.inputTokens,
      outputTokens: costTotals.outputTokens,
      cacheReadTokens: costTotals.cacheReadTokens,
      cacheCreationTokens: costTotals.cacheCreationTokens,
    },
    durationMs,
    modelId,
  };
}

// ── Routes ───────────────────────────────────────────────────────────

app.post("/analyze-document", async (req, res) => {
  const body = req.body as Partial<AnalyzeRequest>;

  // Validate required fields
  if (
    !body.analysisId ||
    !body.documentId ||
    !body.programId ||
    !body.orgId ||
    !body.extractedText ||
    !body.fileName ||
    !body.targetPlatform
  ) {
    res.status(400).json({
      success: false,
      error:
        "Missing required fields: analysisId, documentId, programId, orgId, extractedText, fileName, targetPlatform",
    });
    return;
  }

  const params: AnalyzeRequest = {
    analysisId: body.analysisId,
    documentId: body.documentId,
    programId: body.programId,
    orgId: body.orgId,
    extractedText: body.extractedText,
    mimeType: body.mimeType,
    fileName: body.fileName,
    targetPlatform: body.targetPlatform,
  };

  console.log(`[analyze] Starting analysis for ${params.analysisId} (${params.fileName})`);

  try {
    const { result, usage, durationMs, modelId } = await withRetry(() => runAnalysis(params), {
      maxRetries: 2,
      baseDelayMs: 2000,
    });

    console.log(
      `[analyze] Completed ${params.analysisId} in ${durationMs}ms — ` +
        `${result.requirements.length} requirements, ${result.risks.length} risks, ` +
        `${result.integrations.length} integrations, ${result.decisions.length} decisions`,
    );

    res.json({
      success: true,
      result,
      metadata: {
        analysisId: params.analysisId,
        durationMs,
        usage,
        model: modelId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[analyze] Failed ${params.analysisId}:`, message);
    res.status(500).json({ success: false, error: message });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL ? "configured" : "missing",
    anthropicKey: process.env.ANTHROPIC_API_KEY ? "configured" : "missing",
    timestamp: new Date().toISOString(),
  });
});

// ── Start Server ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Agent service running on port ${PORT}`);
});

export default app;
