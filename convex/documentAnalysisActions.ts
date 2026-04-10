"use node";
import type Anthropic from "@anthropic-ai/sdk";
import { ConvexError, v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { buildAnalysisSystemPrompt } from "./ai/prompts";
import { withRetry } from "./ai/retry";
import { DocumentAnalysisResult } from "./ai/schemas";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// 5. extractDocumentText — action (Node.js runtime for Buffer, mammoth, xlsx)
// ---------------------------------------------------------------------------
export const extractDocumentText = internalAction({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    text: string | null;
    base64: string | null;
    mimeType: string;
    tokenEstimate: number;
  }> => {
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) throw new ConvexError("File not found in storage");

    const buffer = Buffer.from(await blob.arrayBuffer());

    // PDF — pass through as base64 for Claude vision
    if (args.fileType === "application/pdf") {
      const base64 = buffer.toString("base64");
      return {
        text: null,
        base64,
        mimeType: "application/pdf",
        tokenEstimate: Math.ceil(base64.length / 4),
      };
    }

    // DOCX — extract raw text via mammoth
    if (
      args.fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const extractRawText = mammoth.extractRawText ?? (mammoth as any).default?.extractRawText;
      const result = await extractRawText({ buffer });
      const text = result.value;
      return {
        text,
        base64: null,
        mimeType: args.fileType,
        tokenEstimate: Math.ceil(text.length / 4),
      };
    }

    // XLSX / XLS — convert sheets to CSV
    if (
      args.fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      args.fileType === "application/vnd.ms-excel"
    ) {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "buffer" });
      const sheetTexts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheetTexts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
      }
      const text = sheetTexts.join("\n\n");
      return {
        text,
        base64: null,
        mimeType: args.fileType,
        tokenEstimate: Math.ceil(text.length / 4),
      };
    }

    // CSV / TXT / MD — plain text
    const text = buffer.toString("utf-8");
    return {
      text,
      base64: null,
      mimeType: args.fileType,
      tokenEstimate: Math.ceil(text.length / 4),
    };
  },
});

// ---------------------------------------------------------------------------
// 6. analyzeDocument — action (calls Claude directly, no agent service)
// ---------------------------------------------------------------------------
export const analyzeDocument = internalAction({
  args: {
    analysisId: v.string(),
    documentId: v.string(),
    programId: v.string(),
    orgId: v.string(),
    extractedText: v.optional(v.string()),
    base64Content: v.optional(v.string()),
    mimeType: v.string(),
    fileName: v.string(),
    targetPlatform: v.string(),
    focusArea: v.optional(
      v.union(
        v.literal("all"),
        v.literal("requirements"),
        v.literal("risks"),
        v.literal("integrations"),
      ),
    ),
    customInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logArgs = {
      orgId: args.orgId,
      programId: args.programId as any,
      analysisId: args.analysisId as any,
    };

    // Transition to "analyzing"
    await ctx.runMutation(internalApi.documentAnalysis.updateAnalysisStatus, {
      analysisId: args.analysisId as any,
      status: "analyzing",
    });

    await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
      ...logArgs,
      step: "context",
      message: "Building analysis context...",
      level: "info",
    });

    try {
      const startTime = Date.now();

      // 1. Fetch context via internal queries
      const [program, workstreams, existingTitles] = await Promise.all([
        ctx.runQuery(internalApi.documentAnalysis.getProgramById, {
          programId: args.programId as any,
        }),
        ctx.runQuery(internalApi.workstreams.listByProgramInternal, {
          programId: args.programId as any,
        }),
        ctx.runQuery(internalApi.requirements.listTitles, {
          programId: args.programId as any,
        }),
      ]);

      if (!program) {
        throw new Error("Program not found");
      }

      // 2. Build system prompt
      const systemPrompt = buildAnalysisSystemPrompt({
        targetPlatform: args.targetPlatform as "salesforce_b2b" | "bigcommerce_b2b",
        workstreams: workstreams.map((ws: any) => ({
          shortCode: ws.shortCode,
          name: ws.name,
          description: ws.description,
        })),
        existingRequirementTitles: existingTitles as string[],
      });

      // 3. Build user message content
      const userContentParts: Anthropic.ContentBlockParam[] = [];
      const customFocusLines = [
        args.focusArea && args.focusArea !== "all" ? `Focus area: ${args.focusArea}` : null,
        args.customInstructions ? `Custom instructions: ${args.customInstructions}` : null,
      ].filter((line): line is string => Boolean(line));

      if (args.base64Content && args.mimeType === "application/pdf") {
        // PDF — send as document block for Claude's native PDF support
        userContentParts.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: args.base64Content,
          },
        });
        userContentParts.push({
          type: "text",
          text: [
            `Analyze the above PDF document (${args.fileName}) and extract structured findings.`,
            ...customFocusLines,
            "",
            "Respond with ONLY a JSON object (no markdown fences, no explanation) matching this schema:",
            "{",
            '  "requirements": [{ "title": string, "description": string, "priority": "must_have"|"should_have"|"nice_to_have"|"deferred", "fitGap": "native"|"config"|"custom_dev"|"third_party"|"not_feasible", "effortEstimate?": "low"|"medium"|"high"|"very_high", "suggestedWorkstream?": string, "rationale?": string, "potentialMatch?": string, "matchType": "new"|"update"|"duplicate" }],',
            '  "risks": [{ "title": string, "description": string, "severity": "critical"|"high"|"medium"|"low", "probability": "very_likely"|"likely"|"possible"|"unlikely", "mitigation?": string, "affectedWorkstreams?": string[], "potentialMatch?": string, "matchType": "new"|"update"|"duplicate" }],',
            '  "integrations": [{ "name": string, "sourceSystem": string, "targetSystem": string, "protocol": "api"|"webhook"|"file_transfer"|"database"|"middleware"|"other", "direction?": "inbound"|"outbound"|"bidirectional", "dataEntities?": string[], "complexity?": "low"|"medium"|"high", "description?": string }],',
            '  "decisions": [{ "title": string, "description": string, "impact": "high"|"medium"|"low", "category": "architecture"|"data"|"integration"|"process"|"security"|"performance", "alternatives?": string[] }],',
            '  "summary": string,',
            '  "documentType": "gap_analysis"|"architecture"|"data_mapping"|"integration_spec"|"meeting_notes"|"vendor_response"|"requirements_doc"|"other",',
            '  "confidence": "high"|"medium"|"low"',
            "}",
          ].join("\n"),
        });
      } else {
        // Text-based content
        const textContent = args.extractedText ?? "";
        userContentParts.push({
          type: "text",
          text: [
            "Analyze the following document and extract structured findings.",
            ...customFocusLines,
            "",
            "<document>",
            `<file-name>${args.fileName}</file-name>`,
            `<mime-type>${args.mimeType}</mime-type>`,
            "<content>",
            textContent,
            "</content>",
            "</document>",
            "",
            `Respond with ONLY a JSON object (no markdown fences, no explanation) matching this schema:`,
            `{`,
            `  "requirements": [{ "title": string, "description": string, "priority": "must_have"|"should_have"|"nice_to_have"|"deferred", "fitGap": "native"|"config"|"custom_dev"|"third_party"|"not_feasible", "effortEstimate?": "low"|"medium"|"high"|"very_high", "suggestedWorkstream?": string, "rationale?": string, "potentialMatch?": string, "matchType": "new"|"update"|"duplicate" }],`,
            `  "risks": [{ "title": string, "description": string, "severity": "critical"|"high"|"medium"|"low", "probability": "very_likely"|"likely"|"possible"|"unlikely", "mitigation?": string, "affectedWorkstreams?": string[], "potentialMatch?": string, "matchType": "new"|"update"|"duplicate" }],`,
            `  "integrations": [{ "name": string, "sourceSystem": string, "targetSystem": string, "protocol": "api"|"webhook"|"file_transfer"|"database"|"middleware"|"other", "direction?": "inbound"|"outbound"|"bidirectional", "dataEntities?": string[], "complexity?": "low"|"medium"|"high", "description?": string }],`,
            `  "decisions": [{ "title": string, "description": string, "impact": "high"|"medium"|"low", "category": "architecture"|"data"|"integration"|"process"|"security"|"performance", "alternatives?": string[] }],`,
            `  "summary": string,`,
            `  "documentType": "gap_analysis"|"architecture"|"data_mapping"|"integration_spec"|"meeting_notes"|"vendor_response"|"requirements_doc"|"other",`,
            `  "confidence": "high"|"medium"|"low"`,
            `}`,
          ].join("\n"),
        });
      }

      // 4. Call Claude API with retry
      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        step: "calling_ai",
        message: "Analyzing document with AI...",
        level: "info",
      });

      const client = getAnthropicClient();
      const modelId = "claude-opus-4-6";

      const response = await withRetry(
        async () => {
          const stream = client.messages.stream({
            model: modelId,
            max_tokens: 16384,
            system: systemPrompt,
            messages: [{ role: "user", content: userContentParts }],
          });

          let accumulated = "";
          const loggedSections = new Set<string>();
          let firstTokenLogged = false;
          let lastLogTime = 0;

          const SECTION_MARKERS = [
            {
              key: '"requirements"',
              step: "ai_requirements",
              message: "Extracting requirements...",
            },
            { key: '"risks"', step: "ai_risks", message: "Identifying risks..." },
            { key: '"integrations"', step: "ai_integrations", message: "Mapping integrations..." },
            {
              key: '"decisions"',
              step: "ai_decisions",
              message: "Capturing architectural decisions...",
            },
            { key: '"summary"', step: "ai_summary", message: "Generating analysis summary..." },
          ];

          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              accumulated += event.delta.text;

              // Log when first token arrives
              if (!firstTokenLogged) {
                firstTokenLogged = true;
                await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
                  ...logArgs,
                  step: "ai_responding",
                  message: "AI generating analysis...",
                  level: "info",
                });
              }

              // Detect JSON sections (throttled to every 2s)
              const now = Date.now();
              if (now - lastLogTime >= 2000) {
                lastLogTime = now;
                for (const marker of SECTION_MARKERS) {
                  if (!loggedSections.has(marker.key) && accumulated.includes(marker.key)) {
                    loggedSections.add(marker.key);
                    await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
                      ...logArgs,
                      step: marker.step,
                      message: marker.message,
                      level: "info",
                    });
                  }
                }
              }
            }
          }

          // Final sweep for sections that arrived in the last throttle window
          for (const marker of SECTION_MARKERS) {
            if (!loggedSections.has(marker.key) && accumulated.includes(marker.key)) {
              loggedSections.add(marker.key);
              await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
                ...logArgs,
                step: marker.step,
                message: marker.message,
                level: "info",
              });
            }
          }

          return await stream.finalMessage();
        },
        { maxRetries: 2, baseDelayMs: 2000 },
      );

      const durationMs = Date.now() - startTime;

      // 5. Parse and validate the response
      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        step: "parsing",
        message: "Parsing analysis results...",
        level: "info",
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
      }

      let jsonText = textBlock.text.trim();
      // Strip markdown code fences if present
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);
      const result = DocumentAnalysisResult.parse(parsed);

      // 6. Transform into findings format for storage
      const findings = {
        requirements: result.requirements.map((req) => ({
          data: req,
          confidence: result.confidence,
          suggestedWorkstream: req.suggestedWorkstream,
        })),
        risks: result.risks.map((risk) => ({
          data: risk,
          confidence: result.confidence,
          suggestedWorkstream: risk.affectedWorkstreams?.[0],
        })),
        integrations: result.integrations.map((integration) => ({
          data: integration,
          confidence: result.confidence,
        })),
        decisions: result.decisions.map((decision) => ({
          data: decision,
          confidence: result.confidence,
        })),
        summary: result.summary,
        documentType: result.documentType,
        confidence: result.confidence,
      };

      const reqCount = result.requirements.length;
      const riskCount = result.risks.length;
      const intCount = result.integrations.length;
      const decCount = result.decisions.length;

      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        step: "findings",
        message: `Found ${reqCount} requirements, ${riskCount} risks, ${intCount} integrations, ${decCount} decisions`,
        level: "success",
      });

      // 7. Store analysis results
      const usage = response.usage;
      await ctx.runMutation(internalApi.documentAnalysis.storeAnalysisResults, {
        analysisId: args.analysisId as any,
        findings,
        claudeModelId: modelId,
        claudeRequestId: response.id ?? "",
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: (usage as any).cache_read_input_tokens ?? 0,
        cacheCreationTokens: (usage as any).cache_creation_input_tokens ?? 0,
        durationMs,
      });

      // 7b. Record AI usage for billing (best-effort)
      try {
        const tokenUsage = extractTokenUsage(response, modelId);
        await ctx.runMutation(internalApi.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId as any,
          source: "document_analysis" as const,
          claudeModelId: modelId,
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          cacheReadTokens: tokenUsage.cacheReadTokens,
          cacheCreationTokens: tokenUsage.cacheCreationTokens,
          costUsd: calculateCostUsd(tokenUsage),
          durationMs,
          sourceEntityId: String(args.analysisId),
          sourceEntityTable: "documentAnalyses",
        });
      } catch (e) {
        console.error("[billing] Failed to record document analysis usage:", e);
      }

      // Best-effort execution logging
      try {
        const tokenUsage = extractTokenUsage(response, modelId);
        const tokensUsed = tokenUsage.inputTokens + tokenUsage.outputTokens;
        await ctx.runMutation(internalApi.ai.logExecution, {
          orgId: args.orgId,
          programId: args.programId as any,
          executionMode: "platform" as const,
          trigger: "manual" as const,
          taskType: "document_analysis",
          inputSummary: `Document: ${args.fileName}`,
          outputSummary: `${result.requirements.length} requirements, ${result.risks.length} risks, ${result.integrations.length} integrations, ${result.decisions.length} decisions`,
          tokensUsed,
          durationMs,
          modelId,
        });
      } catch {
        /* best-effort */
      }

      // 8. Fan out findings into discoveryFindings records
      await ctx.runMutation(internalApi.documentAnalysis.createDiscoveryFindings, {
        orgId: args.orgId,
        programId: args.programId as any,
        analysisId: args.analysisId as any,
        documentId: args.documentId as any,
        findings,
      });

      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        step: "complete",
        message: "Analysis complete",
        level: "success",
      });
    } catch (error: any) {
      await ctx.runMutation(internalApi.documentAnalysis.updateAnalysisStatus, {
        analysisId: args.analysisId as any,
        status: "failed",
        error: error.message ?? "Unknown error during analysis",
      });
      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        step: "failed",
        message: `Analysis failed: ${error.message ?? "Unknown error"}`,
        level: "error",
      });
    }
  },
});

// ---------------------------------------------------------------------------
// 8. queueBatchAnalysis — action
//    Creates analysis records and schedules each document for async processing.
//    Returns immediately so the wizard can advance to the AI Analysis step.
// ---------------------------------------------------------------------------
export const queueBatchAnalysis = action({
  args: {
    orgId: v.string(),
    programId: v.string(),
    documentIds: v.array(v.string()),
    targetPlatform: v.string(),
    focusArea: v.optional(
      v.union(
        v.literal("all"),
        v.literal("requirements"),
        v.literal("risks"),
        v.literal("integrations"),
      ),
    ),
    customInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Gate check — doc analyses count against session budget for trial orgs
    const gateResult = await ctx.runQuery(internalApi.billing.gates.checkPlanLimitsQuery, {
      orgId: args.orgId,
      resource: "document_analysis",
    });
    if (!gateResult.allowed) {
      throw new ConvexError({
        code: "PLAN_LIMIT_EXCEEDED",
        resource: "document_analysis",
        current: gateResult.currentCount,
        limit: gateResult.limit,
        reason: gateResult.reason,
      });
    }
    // gateResult.isOverage means overage billing applies

    // Increment trial session counter for each document if org is in trial
    // (doc analyses count against the session budget during trial)
    try {
      for (let i = 0; i < args.documentIds.length; i++) {
        await ctx.runMutation(internalApi.billing.trial.incrementTrialSession, {
          orgId: args.orgId,
        });
      }
    } catch {
      // No trial or limit reached mid-batch — ignore (gate check already passed)
    }

    for (const documentId of args.documentIds) {
      // Schedule async processing — each document gets its own action with
      // its own 10-minute timeout, running independently in the background.
      // Note: triggerSingleAnalysis creates its own analysis record, so we
      // don't create one here (doing so would produce orphaned duplicates).
      await ctx.scheduler.runAfter(0, internalApi.documentAnalysisActions.triggerSingleAnalysis, {
        orgId: args.orgId,
        programId: args.programId,
        documentId,
        targetPlatform: args.targetPlatform,
        focusArea: args.focusArea,
        customInstructions: args.customInstructions,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// 11. triggerSingleAnalysis — internalAction
// ---------------------------------------------------------------------------
export const triggerSingleAnalysis = internalAction({
  args: {
    orgId: v.string(),
    programId: v.string(),
    documentId: v.string(),
    targetPlatform: v.string(),
    focusArea: v.optional(
      v.union(
        v.literal("all"),
        v.literal("requirements"),
        v.literal("risks"),
        v.literal("integrations"),
      ),
    ),
    customInstructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const logArgs = {
      orgId: args.orgId,
      programId: args.programId as any,
    };

    // Create analysis record
    const analysisId: string = await ctx.runMutation(internalApi.documentAnalysis.createAnalysis, {
      orgId: args.orgId,
      programId: args.programId as any,
      documentId: args.documentId as any,
    });

    await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
      ...logArgs,
      analysisId: analysisId as any,
      step: "queued",
      message: "Queued for analysis",
      level: "info",
    });

    // Update status to extracting
    await ctx.runMutation(internalApi.documentAnalysis.updateAnalysisStatus, {
      analysisId: analysisId as any,
      status: "extracting",
    });

    // Fetch document
    const doc = await ctx.runQuery(internalApi.documentAnalysis.getDocumentById, {
      documentId: args.documentId as any,
    });
    if (!doc) {
      await ctx.runMutation(internalApi.documentAnalysis.updateAnalysisStatus, {
        analysisId: analysisId as any,
        status: "failed",
        error: "Document not found",
      });
      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        analysisId: analysisId as any,
        step: "failed",
        message: "Analysis failed: Document not found",
        level: "error",
      });
      return;
    }

    await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
      ...logArgs,
      analysisId: analysisId as any,
      step: "extracting",
      message: `Extracting text from ${doc.fileName}...`,
      level: "info",
    });

    if (!doc.storageId) {
      await ctx.runMutation(internalApi.documentAnalysis.updateAnalysisStatus, {
        analysisId: analysisId as any,
        status: "failed",
        error: "Document file is not stored in Convex storage",
      });
      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        analysisId: analysisId as any,
        step: "failed",
        message: "Analysis failed: Document file is not stored in Convex",
        level: "error",
      });
      return;
    }

    // Extract text
    let extraction;
    try {
      extraction = await ctx.runAction(internalApi.documentAnalysisActions.extractDocumentText, {
        storageId: doc.storageId,
        fileName: doc.fileName,
        fileType: doc.fileType,
      });
    } catch (error: any) {
      await ctx.runMutation(internalApi.documentAnalysis.updateAnalysisStatus, {
        analysisId: analysisId as any,
        status: "failed",
        error: `Text extraction failed: ${error.message}`,
      });
      await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
        ...logArgs,
        analysisId: analysisId as any,
        step: "failed",
        message: `Analysis failed: Text extraction failed`,
        detail: error.message,
        level: "error",
      });
      return;
    }

    await ctx.runMutation(internalApi.documentAnalysis.logActivity, {
      ...logArgs,
      analysisId: analysisId as any,
      step: "extracted",
      message: `Text extracted — ~${extraction.tokenEstimate.toLocaleString()} tokens`,
      level: "success",
    });

    // Run analysis
    await ctx.runAction(internalApi.documentAnalysisActions.analyzeDocument, {
      analysisId,
      documentId: args.documentId,
      programId: args.programId,
      orgId: args.orgId,
      extractedText: extraction.text ?? undefined,
      base64Content: extraction.base64 ?? undefined,
      mimeType: extraction.mimeType,
      fileName: doc.fileName,
      targetPlatform: args.targetPlatform,
      focusArea: args.focusArea,
      customInstructions: args.customInstructions,
    });
  },
});
