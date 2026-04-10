interface WorkstreamInfo {
  shortCode: string;
  name: string;
  description?: string;
}

interface PromptContext {
  targetPlatform:
    | "magento"
    | "salesforce_b2b"
    | "bigcommerce_b2b"
    | "sitecore"
    | "wordpress"
    | "none";
  workstreams: WorkstreamInfo[];
  existingRequirementTitles: string[];
  engagementType?: "greenfield" | "migration" | "integration" | "ongoing_product_dev";
  techStack?: { category: string; technologies: string[] }[];
}

const PLATFORM_NAMES: Record<string, string> = {
  magento: "Magento",
  salesforce_b2b: "Salesforce B2B Commerce",
  bigcommerce_b2b: "BigCommerce B2B Edition",
  sitecore: "Sitecore",
  wordpress: "WordPress",
  none: "None",
};

export function buildAnalysisSystemPrompt(context: PromptContext): string {
  const platformName = PLATFORM_NAMES[context.targetPlatform] ?? context.targetPlatform;

  const isMigration =
    context.engagementType === "migration" ||
    (context.targetPlatform && context.targetPlatform !== "none");

  const workstreamList = context.workstreams
    .map((ws) => `- ${ws.shortCode}: ${ws.name}${ws.description ? ` — ${ws.description}` : ""}`)
    .join("\n");

  const duplicateWarning =
    context.existingRequirementTitles.length > 0
      ? `\n<existing-requirements>\nThe following requirements already exist in the program. Use them for match classification:\n${context.existingRequirementTitles.map((t) => `- ${t}`).join("\n")}\nFor every extracted requirement and risk, set "matchType" to "new" | "update" | "duplicate".\nIf "matchType" is "update" or "duplicate", populate "potentialMatch" with the closest matching existing title.\nIf "matchType" is "new", omit "potentialMatch".\n</existing-requirements>`
      : "";

  const techStackSection =
    context.techStack && context.techStack.length > 0
      ? `\n<tech-stack>\n${context.techStack.map((t) => `- ${t.category}: ${t.technologies.join(", ")}`).join("\n")}\n</tech-stack>`
      : "";

  const roleDescription = isMigration
    ? `You are a delivery discovery analyst specializing in ${platformName} migrations.`
    : `You are a delivery discovery analyst for software delivery programs.`;

  const documentType = isMigration ? "migration documents" : "project documents";

  const migrationQualityLines = isMigration
    ? `- Each requirement must be actionable and specific to the migration
- Assign priority based on business impact and migration criticality
- For fitGap assessment, consider ${platformName}'s native capabilities
- Avoid extracting generic statements — focus on migration-specific content`
    : `- Each requirement must be actionable and specific to the project
- Assign priority based on business impact and delivery criticality
- For fitGap assessment, consider the target platform's native capabilities
- Avoid extracting generic statements — focus on project-specific content`;

  const impactLabel = isMigration ? "migration impact" : "delivery impact";

  return `${roleDescription}

<role>
You analyze ${documentType} and extract structured findings: requirements, risks, integrations, and architectural decisions. Your output is used to pre-populate a program's discovery phase.
</role>
${isMigration ? `\n<target-platform>${platformName}</target-platform>` : ""}
<workstreams>
${workstreamList}
</workstreams>
${techStackSection}${duplicateWarning}
<quality-standards>
${migrationQualityLines}
- Map each finding to the most relevant workstream using short codes (e.g., WS-3)
- Flag risks with concrete severity and probability assessments
- Identify integration points between systems with protocol details
- Extract architectural decisions with their rationale and alternatives considered
- Include source excerpts to support each finding
- When uncertain, set confidence to "medium" or "low"
- Always set matchType for requirements and risks ("new", "update", or "duplicate")
- Use potentialMatch only when matchType is "update" or "duplicate"
</quality-standards>

<instructions>
Analyze the provided document thoroughly. Extract ALL relevant findings organized by type. For each finding:
1. Provide a clear, concise title
2. Include detailed description with context
3. Assess priority/severity based on ${impactLabel}
4. Suggest the most appropriate workstream
5. Include the source excerpt from the document that supports the finding
6. Rate your confidence (high/medium/low) in the extraction accuracy
</instructions>`;
}
