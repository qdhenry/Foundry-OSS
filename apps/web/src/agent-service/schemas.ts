import { z } from "zod";

export const ExtractedRequirement = z.object({
  title: z.string().describe("Concise requirement title (5-15 words)"),
  description: z.string().describe("Detailed requirement description"),
  priority: z
    .enum(["must_have", "should_have", "nice_to_have", "deferred"])
    .describe("Business priority"),
  fitGap: z
    .enum(["native", "config", "custom_dev", "third_party", "not_feasible"])
    .describe("Implementation approach on target platform"),
  effortEstimate: z
    .enum(["low", "medium", "high", "very_high"])
    .optional()
    .describe("Development effort estimate"),
  suggestedWorkstream: z.string().optional().describe("Workstream short code (e.g., WS-3)"),
  rationale: z.string().optional().describe("Why this was identified as a requirement"),
});

export const ExtractedRisk = z.object({
  title: z.string().describe("Concise risk title"),
  description: z.string().describe("Risk description and potential impact"),
  severity: z.enum(["critical", "high", "medium", "low"]).describe("Impact severity"),
  probability: z
    .enum(["very_likely", "likely", "possible", "unlikely"])
    .describe("Likelihood of occurrence"),
  mitigation: z.string().optional().describe("Suggested mitigation strategy"),
  affectedWorkstreams: z.array(z.string()).optional().describe("Workstream short codes affected"),
});

export const ExtractedIntegration = z.object({
  name: z.string().describe("Integration name"),
  sourceSystem: z.string().describe("Source system name"),
  targetSystem: z.string().describe("Target system name"),
  protocol: z
    .enum(["api", "webhook", "file_transfer", "database", "middleware", "other"])
    .describe("Integration protocol/type"),
  direction: z
    .enum(["inbound", "outbound", "bidirectional"])
    .optional()
    .describe("Data flow direction"),
  dataEntities: z
    .array(z.string())
    .optional()
    .describe("Data entities involved (e.g., orders, customers)"),
  complexity: z.enum(["low", "medium", "high"]).optional().describe("Integration complexity"),
  description: z.string().optional().describe("Detailed description of the integration"),
});

export const ExtractedDecision = z.object({
  title: z.string().describe("Decision title"),
  description: z.string().describe("What was decided and why"),
  impact: z.enum(["high", "medium", "low"]).describe("Impact level"),
  category: z
    .enum(["architecture", "data", "integration", "process", "security", "performance"])
    .describe("Decision category"),
  alternatives: z.array(z.string()).optional().describe("Alternatives that were considered"),
});

export const DocumentAnalysisResult = z.object({
  requirements: z.array(ExtractedRequirement).describe("Extracted requirements from the document"),
  risks: z.array(ExtractedRisk).describe("Identified risks"),
  integrations: z.array(ExtractedIntegration).describe("Integration points identified"),
  decisions: z.array(ExtractedDecision).describe("Architectural or process decisions found"),
  summary: z.string().describe("Brief summary of the document's key findings"),
  documentType: z
    .enum([
      "gap_analysis",
      "architecture",
      "data_mapping",
      "integration_spec",
      "meeting_notes",
      "vendor_response",
      "requirements_doc",
      "other",
    ])
    .describe("Classified document type"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Overall confidence in extraction quality"),
});

export type ExtractedRequirementType = z.infer<typeof ExtractedRequirement>;
export type ExtractedRiskType = z.infer<typeof ExtractedRisk>;
export type ExtractedIntegrationType = z.infer<typeof ExtractedIntegration>;
export type ExtractedDecisionType = z.infer<typeof ExtractedDecision>;
export type DocumentAnalysisResultType = z.infer<typeof DocumentAnalysisResult>;
