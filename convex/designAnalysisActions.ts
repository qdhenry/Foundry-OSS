"use node";
import { v } from "convex/values";
import * as generatedApi from "./_generated/api";
import { internalAction } from "./_generated/server";
import { withRetry } from "./ai/retry";
import { getAnthropicClient } from "./lib/aiClient";
import { calculateCostUsd, extractTokenUsage } from "./lib/aiCostTracking";

const internalApi: any = (generatedApi as any).internal;

// ---------------------------------------------------------------------------
// analyzeScreenshot — internal action (Node.js runtime for Anthropic SDK)
//
// Fetches a screenshot from Convex storage, sends it to Claude with vision,
// and stores the extracted design spec (colors, typography, layout, components).
// ---------------------------------------------------------------------------

const ANALYSIS_MODEL = "claude-opus-4-1-20250805";

const ANALYSIS_PROMPT = `You are a senior UI/UX engineer. Analyze this screenshot and extract a precise design specification.

Return ONLY a JSON object (no markdown fences, no explanation) with this exact structure:

{
  "layout": {
    "type": "grid|flex|stack|absolute|float",
    "columns": null,
    "spacing": "description of spacing system used",
    "responsive": "description of responsive behavior if detectable"
  },
  "colors": [
    {
      "name": "descriptive name (e.g. primary-blue, background-light)",
      "hex": "#RRGGBB",
      "usage": "where/how this color is used (e.g. primary buttons, card backgrounds)"
    }
  ],
  "typography": [
    {
      "role": "heading1|heading2|heading3|body|caption|label|button|nav|code|other",
      "fontFamily": "detected or best guess font family",
      "fontSize": "estimated size (e.g. 24px, 1.5rem)",
      "fontWeight": "100-900 or name (e.g. bold, semibold)",
      "lineHeight": "estimated line-height if detectable"
    }
  ],
  "components": [
    {
      "name": "descriptive name (e.g. Hero Section, Product Card, Navigation Bar)",
      "type": "button|card|nav|header|footer|sidebar|modal|form|input|table|list|image|icon|badge|tag|tooltip|dropdown|tabs|accordion|hero|section|other",
      "description": "brief description of the component's purpose and visual characteristics",
      "boundingBox": {
        "x": 0.0,
        "y": 0.0,
        "width": 0.0,
        "height": 0.0
      }
    }
  ],
  "spacing": {
    "unit": "px or rem — the base spacing unit detected",
    "scale": "description of the spacing scale (e.g. 4px base: 4, 8, 12, 16, 24, 32, 48)"
  }
}

Important rules:
- boundingBox values are percentages (0-100) relative to the full image dimensions
- Extract ALL visible colors, not just the most prominent ones
- Identify every distinct UI component visible in the screenshot
- For typography, estimate sizes based on visual proportions
- Be precise with hex color values — use your best visual assessment
- If you cannot determine a value, use your best professional judgment rather than omitting it`;

export const analyzeScreenshot = internalAction({
  args: {
    designAssetId: v.string(),
    programId: v.string(),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    try {
      // 1. Fetch the asset record
      const asset = await ctx.runQuery(internalApi.designAnalysisHelpers.getAssetInternal, {
        assetId: args.designAssetId,
      });
      if (!asset) {
        throw new Error("Design asset not found");
      }
      if (!asset.fileId) {
        throw new Error("Design asset has no file attached");
      }

      // 2. Fetch the file blob from Convex storage
      const blob = await ctx.storage.get(asset.fileId);
      if (!blob) {
        throw new Error("File not found in storage");
      }

      // 3. Convert to base64
      const buffer = Buffer.from(await blob.arrayBuffer());
      const base64Data = buffer.toString("base64");

      // Determine media type from the asset's mimeType or default to png
      const mediaType = (asset.mimeType || "image/png") as
        | "image/png"
        | "image/jpeg"
        | "image/gif"
        | "image/webp";

      // 4. Call Claude with vision
      const client = getAnthropicClient();

      const response = await withRetry(
        async () => {
          return client.messages.create({
            model: ANALYSIS_MODEL,
            max_tokens: 8192,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: mediaType,
                      data: base64Data,
                    },
                  },
                  {
                    type: "text",
                    text: ANALYSIS_PROMPT,
                  },
                ],
              },
            ],
          });
        },
        { maxRetries: 2, baseDelayMs: 2000 },
      );

      const durationMs = Date.now() - startTime;

      // 5. Parse the JSON response
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

      // 6. Generate a markdown summary from the structured spec
      const markdownSummary = generateMarkdownSummary(parsed, asset.name);

      // 7. Extract token usage
      const usage = response.usage;
      const inputTokens = usage.input_tokens ?? 0;
      const outputTokens = usage.output_tokens ?? 0;
      const cacheReadTokens =
        (usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0;
      const cacheCreationTokens =
        (usage as unknown as Record<string, number>).cache_creation_input_tokens ?? 0;

      // 8. Store results
      await ctx.runMutation(internalApi.designAnalysisHelpers.storeAnalysis, {
        designAssetId: args.designAssetId,
        programId: args.programId,
        orgId: args.orgId,
        structuredSpec: JSON.stringify(parsed),
        markdownSummary,
        extractedColors: (parsed.colors ?? []).map((c: any) => ({
          name: String(c.name ?? ""),
          hex: String(c.hex ?? ""),
          usage: String(c.usage ?? ""),
        })),
        extractedTypography: (parsed.typography ?? []).map((t: any) => ({
          role: String(t.role ?? ""),
          fontFamily: String(t.fontFamily ?? ""),
          fontSize: String(t.fontSize ?? ""),
          fontWeight: String(t.fontWeight ?? ""),
          lineHeight: t.lineHeight ? String(t.lineHeight) : undefined,
        })),
        extractedComponents: (parsed.components ?? []).map((c: any) => ({
          name: String(c.name ?? ""),
          type: String(c.type ?? ""),
          description: String(c.description ?? ""),
          boundingBox: c.boundingBox
            ? {
                x: Number(c.boundingBox.x ?? 0),
                y: Number(c.boundingBox.y ?? 0),
                width: Number(c.boundingBox.width ?? 0),
                height: Number(c.boundingBox.height ?? 0),
              }
            : undefined,
        })),
        extractedLayout: parsed.layout
          ? {
              type: String(parsed.layout.type ?? ""),
              columns: parsed.layout.columns != null ? Number(parsed.layout.columns) : undefined,
              spacing: parsed.layout.spacing ? String(parsed.layout.spacing) : undefined,
              responsive: parsed.layout.responsive ? String(parsed.layout.responsive) : undefined,
            }
          : undefined,
        model: ANALYSIS_MODEL,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        durationMs,
      });

      // 9. Update asset status to "analyzed"
      await ctx.runMutation(internalApi.designAnalysisHelpers.updateAssetStatus, {
        assetId: args.designAssetId,
        status: "analyzed",
      });

      // 10. Record AI usage for billing (best-effort)
      try {
        const tokenUsage = extractTokenUsage(response, ANALYSIS_MODEL);
        await ctx.runMutation(internalApi.billing.usageRecords.recordAiUsage, {
          orgId: args.orgId,
          programId: args.programId as any,
          source: "design_analysis" as const,
          claudeModelId: ANALYSIS_MODEL,
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          cacheReadTokens: tokenUsage.cacheReadTokens,
          cacheCreationTokens: tokenUsage.cacheCreationTokens,
          costUsd: calculateCostUsd(tokenUsage),
          durationMs,
          sourceEntityId: args.designAssetId,
          sourceEntityTable: "designAnalyses",
        });
      } catch (e) {
        console.error("[billing] Failed to record design analysis usage:", e);
      }

      // Best-effort execution logging
      try {
        const tokenUsage = extractTokenUsage(response, ANALYSIS_MODEL);
        const tokensUsed = tokenUsage.inputTokens + tokenUsage.outputTokens;
        await ctx.runMutation(internalApi.ai.logExecution, {
          orgId: args.orgId,
          programId: args.programId as any,
          executionMode: "platform" as const,
          trigger: "manual" as const,
          taskType: "design_analysis",
          inputSummary: `Asset: ${args.designAssetId}`,
          outputSummary: `${(parsed.components ?? []).length} components, ${(parsed.colors ?? []).length} colors`,
          tokensUsed,
          durationMs,
          modelId: ANALYSIS_MODEL,
        });
      } catch {
        /* best-effort */
      }
    } catch (error: any) {
      console.error(
        "[design-analysis] Screenshot analysis failed for asset",
        args.designAssetId,
        error,
      );
      // Update asset status to "error"
      try {
        await ctx.runMutation(internalApi.designAnalysisHelpers.updateAssetStatus, {
          assetId: args.designAssetId,
          status: "error",
          error: error.message ?? "Unknown error during screenshot analysis",
        });
      } catch (statusError: any) {
        console.error("[design-analysis] Failed to update asset status to error:", statusError);
      }
    }
  },
});

// ---------------------------------------------------------------------------
// runVisualDiff — compare reference design vs sandbox output image
//
// Sends both images to Claude vision, extracts structural + pixel scores,
// and persists the result in designFidelityChecks via the helpers mutation.
// ---------------------------------------------------------------------------

const VISUAL_DIFF_PROMPT = `You are a senior QA engineer comparing a reference design to an implementation screenshot.

Analyze the two images:
- Image 1: Reference design (the intended look)
- Image 2: Implementation (the actual output)

Return ONLY a JSON object (no markdown fences, no explanation) with this exact structure:

{
  "structuralScore": 85,
  "pixelScore": 78,
  "deviations": [
    {
      "area": "Navigation bar",
      "severity": "minor",
      "description": "Font size slightly smaller than reference"
    }
  ]
}

Scoring rules:
- structuralScore (0-100): How well the layout, component placement, hierarchy, and spacing match the reference. 100 = perfect structural match.
- pixelScore (0-100): How closely the colors, typography details, and visual styling match. 100 = pixel-perfect match.
- deviations: List each notable difference. severity must be one of: "minor", "moderate", "major".
  - minor: cosmetic difference, does not affect usability
  - moderate: noticeable difference, may affect perception of quality
  - major: significant deviation that changes layout or breaks design intent

Be thorough but fair. Minor responsive adjustments should not be penalized heavily.`;

export const runVisualDiff = internalAction({
  args: {
    taskId: v.string(),
    programId: v.string(),
    orgId: v.string(),
    referenceImageStorageId: v.string(),
    outputImageStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const refBlob = await ctx.storage.get(args.referenceImageStorageId as any);
    const outBlob = await ctx.storage.get(args.outputImageStorageId as any);
    if (!refBlob || !outBlob) throw new Error("Images not found");

    const refBase64 = Buffer.from(await refBlob.arrayBuffer()).toString("base64");
    const outBase64 = Buffer.from(await outBlob.arrayBuffer()).toString("base64");

    const client = getAnthropicClient();

    const response = await withRetry(
      async () => {
        return client.messages.create({
          model: ANALYSIS_MODEL,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: refBase64,
                  },
                },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/png",
                    data: outBase64,
                  },
                },
                { type: "text", text: VISUAL_DIFF_PROMPT },
              ],
            },
          ],
        });
      },
      { maxRetries: 2, baseDelayMs: 2000 },
    );

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No response");

    let result: any;
    try {
      result = JSON.parse(textBlock.text);
    } catch {
      const jsonMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) result = JSON.parse(jsonMatch[1]);
      else throw new Error("Failed to parse visual diff response");
    }

    const overallScore = Math.round(
      0.7 * result.structuralScore + 0.3 * (result.pixelScore ?? result.structuralScore),
    );

    await ctx.runMutation(internalApi.designAnalysisHelpers.storeFidelityCheck, {
      orgId: args.orgId,
      taskId: args.taskId,
      programId: args.programId,
      referenceImageId: args.referenceImageStorageId,
      outputImageId: args.outputImageStorageId,
      structuralScore: result.structuralScore,
      pixelScore: result.pixelScore ?? result.structuralScore,
      overallScore,
      deviations: result.deviations ?? [],
    });
  },
});

// ---------------------------------------------------------------------------
// Helper: generate a human-readable markdown summary from the structured spec
// ---------------------------------------------------------------------------
function generateMarkdownSummary(spec: Record<string, any>, assetName: string): string {
  const lines: string[] = [];

  lines.push(`# Design Analysis: ${assetName}`);
  lines.push("");

  // Layout
  if (spec.layout) {
    lines.push("## Layout");
    lines.push(`- **Type:** ${spec.layout.type}`);
    if (spec.layout.columns != null) lines.push(`- **Columns:** ${spec.layout.columns}`);
    if (spec.layout.spacing) lines.push(`- **Spacing:** ${spec.layout.spacing}`);
    if (spec.layout.responsive) lines.push(`- **Responsive:** ${spec.layout.responsive}`);
    lines.push("");
  }

  // Colors
  const colors = spec.colors ?? [];
  if (colors.length > 0) {
    lines.push("## Colors");
    lines.push(`Found ${colors.length} color(s):`);
    lines.push("");
    for (const c of colors) {
      lines.push(`- **${c.name}** \`${c.hex}\` — ${c.usage}`);
    }
    lines.push("");
  }

  // Typography
  const typography = spec.typography ?? [];
  if (typography.length > 0) {
    lines.push("## Typography");
    lines.push(`Found ${typography.length} type style(s):`);
    lines.push("");
    for (const t of typography) {
      const parts = [`${t.fontFamily}`, `${t.fontSize}`, `${t.fontWeight}`];
      if (t.lineHeight) parts.push(`lh: ${t.lineHeight}`);
      lines.push(`- **${t.role}:** ${parts.join(", ")}`);
    }
    lines.push("");
  }

  // Components
  const components = spec.components ?? [];
  if (components.length > 0) {
    lines.push("## Components");
    lines.push(`Found ${components.length} component(s):`);
    lines.push("");
    for (const c of components) {
      lines.push(`- **${c.name}** (${c.type}) — ${c.description}`);
    }
    lines.push("");
  }

  // Spacing
  if (spec.spacing) {
    lines.push("## Spacing");
    lines.push(`- **Unit:** ${spec.spacing.unit}`);
    if (spec.spacing.scale) lines.push(`- **Scale:** ${spec.spacing.scale}`);
    lines.push("");
  }

  return lines.join("\n");
}
