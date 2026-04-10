import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  agentNotifications,
  agentTaskExecutions,
  agentTemplates,
  agentVersions,
  orgAgentSettings,
  programAgents,
  sprintWorkflows,
} from "./agentTeam/schema";
import { orchestrationEvents, orchestrationRuns } from "./orchestration/schema";
import { sandboxRuntimeModeValidator, setupProgressValidator } from "./sandbox/validators";
import {
  findingConfidenceValidator,
  findingReviewStatusValidator,
  optionalVideoFindingAttributionValidator,
  videoAnalysisStatusValidator,
  videoFindingAttributionValidator,
  videoFindingTypeValidator,
  videoRetentionPolicyValidator,
  videoSourceSpeakerValidator,
} from "./shared/videoContracts";

export default defineSchema({
  // 1. Programs — root entity for a delivery program
  programs: defineTable({
    orgId: v.string(),
    name: v.string(),
    clientName: v.string(),
    sourcePlatform: v.optional(
      v.union(
        v.literal("magento"),
        v.literal("salesforce_b2b"),
        v.literal("bigcommerce_b2b"),
        v.literal("sitecore"),
        v.literal("wordpress"),
        v.literal("none"),
      ),
    ),
    targetPlatform: v.optional(
      v.union(
        v.literal("magento"),
        v.literal("salesforce_b2b"),
        v.literal("bigcommerce_b2b"),
        v.literal("sitecore"),
        v.literal("wordpress"),
        v.literal("none"),
      ),
    ),
    engagementType: v.optional(
      v.union(
        v.literal("greenfield"),
        v.literal("migration"),
        v.literal("integration"),
        v.literal("ongoing_product_dev"),
      ),
    ),
    techStack: v.optional(
      v.array(
        v.object({
          category: v.string(),
          technologies: v.array(v.string()),
        }),
      ),
    ),
    phase: v.union(
      v.literal("discovery"),
      v.literal("build"),
      v.literal("test"),
      v.literal("deploy"),
      v.literal("complete"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("complete"),
      v.literal("archived"),
    ),
    startDate: v.optional(v.number()),
    targetEndDate: v.optional(v.number()),
    description: v.optional(v.string()),
    // Discovery Accelerator extensions
    setupStatus: v.optional(
      v.union(
        v.literal("wizard"),
        v.literal("analyzing"),
        v.literal("review"),
        v.literal("complete"),
      ),
    ),
    discoveryStats: v.optional(v.any()),
    // Phase 8: Atlassian foundation
    jiraSyncMode: v.optional(
      v.union(v.literal("auto"), v.literal("auto_status_only"), v.literal("approval_required")),
    ),
    jiraWorkflowConfigured: v.optional(v.boolean()),
    confluenceAutoIngest: v.optional(v.boolean()),
    confluenceIngestFilter: v.optional(v.string()),
    slug: v.optional(v.string()),
    agentTeamGenerated: v.optional(v.boolean()),
    defaultSprintWorkflowConfig: v.optional(v.any()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_slug", ["orgId", "slug"]),

  // 2. Workstreams — functional delivery tracks within a program
  workstreams: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    shortCode: v.string(),
    ownerId: v.optional(v.id("users")),
    status: v.union(v.literal("on_track"), v.literal("at_risk"), v.literal("blocked")),
    sprintCadence: v.optional(v.number()),
    currentSprint: v.optional(v.number()),
    sortOrder: v.number(),
    description: v.optional(v.string()),
    // Phase 2: AI health scoring
    healthLastUpdated: v.optional(v.number()),
    // Repository bindings — references to sourceControlRepositories
    repositoryIds: v.optional(v.array(v.id("sourceControlRepositories"))),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"]),

  // 3. Requirements — gap analysis findings
  requirements: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    refId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    batch: v.optional(v.string()),
    priority: v.union(
      v.literal("must_have"),
      v.literal("should_have"),
      v.literal("nice_to_have"),
      v.literal("deferred"),
    ),
    fitGap: v.union(
      v.literal("native"),
      v.literal("config"),
      v.literal("custom_dev"),
      v.literal("third_party"),
      v.literal("not_feasible"),
    ),
    effortEstimate: v.optional(
      v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("very_high")),
    ),
    deliveryPhase: v.optional(
      v.union(v.literal("phase_1"), v.literal("phase_2"), v.literal("phase_3")),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("in_progress"),
      v.literal("complete"),
      v.literal("deferred"),
    ),
    dependencies: v.optional(v.array(v.id("requirements"))),
    // Codebase analysis — implementation tracking
    implementationStatus: v.optional(
      v.union(
        v.literal("not_found"),
        v.literal("partially_implemented"),
        v.literal("fully_implemented"),
        v.literal("needs_verification"),
      ),
    ),
    implementationConfidence: v.optional(v.number()),
    lastAnalyzedAt: v.optional(v.number()),
    lastAnalysisRunId: v.optional(v.id("codebaseAnalysisRuns")),
  })
    .index("by_program", ["programId"])
    .index("by_workstream", ["workstreamId"])
    .index("by_org", ["orgId"])
    .index("by_batch", ["programId", "batch"]),

  // 4. Skills — AI agent instruction sets
  skills: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    domain: v.union(
      v.literal("architecture"),
      v.literal("backend"),
      v.literal("frontend"),
      v.literal("integration"),
      v.literal("deployment"),
      v.literal("testing"),
      v.literal("review"),
      v.literal("project"),
    ),
    targetPlatform: v.union(
      v.literal("salesforce_b2b"),
      v.literal("bigcommerce_b2b"),
      v.literal("sitecore"),
      v.literal("wordpress"),
      v.literal("none"),
      v.literal("platform_agnostic"),
    ),
    currentVersion: v.string(),
    content: v.string(),
    lineCount: v.number(),
    linkedRequirements: v.optional(v.array(v.id("requirements"))),
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("deprecated")),
  })
    .index("by_program", ["programId"])
    .index("by_domain", ["programId", "domain"])
    .index("by_org", ["orgId"]),

  // 5. Skill Versions — immutable version history for skills
  skillVersions: defineTable({
    orgId: v.string(),
    skillId: v.id("skills"),
    version: v.string(),
    content: v.string(),
    lineCount: v.number(),
    authorId: v.id("users"),
    message: v.optional(v.string()),
  })
    .index("by_skill", ["skillId"])
    .index("by_org", ["orgId"]),

  // 6. Risks — risk register entries
  risks: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    title: v.string(),
    description: v.optional(v.string()),
    severity: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    probability: v.union(
      v.literal("very_likely"),
      v.literal("likely"),
      v.literal("possible"),
      v.literal("unlikely"),
    ),
    mitigation: v.optional(v.string()),
    ownerId: v.optional(v.id("users")),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
    status: v.union(
      v.literal("open"),
      v.literal("mitigating"),
      v.literal("resolved"),
      v.literal("accepted"),
    ),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"]),

  // 7. Sprint Gates — quality gates for workstream sprints
  sprintGates: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
    name: v.string(),
    gateType: v.union(
      v.literal("foundation"),
      v.literal("development"),
      v.literal("integration"),
      v.literal("release"),
    ),
    criteria: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        passed: v.boolean(),
        evidence: v.optional(v.string()),
      }),
    ),
    approvals: v.array(
      v.object({
        userId: v.id("users"),
        role: v.string(),
        status: v.union(v.literal("pending"), v.literal("approved"), v.literal("declined")),
        timestamp: v.optional(v.number()),
      }),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("passed"),
      v.literal("failed"),
      v.literal("overridden"),
    ),
    evaluatedAt: v.optional(v.number()),
  })
    .index("by_program", ["programId"])
    .index("by_workstream", ["workstreamId"]),

  // 8. Agent Executions — telemetry for AI agent invocations
  agentExecutions: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    skillId: v.optional(v.id("skills")),
    workstreamId: v.optional(v.id("workstreams")),
    taskId: v.optional(v.id("tasks")),
    executionMode: v.union(v.literal("local"), v.literal("platform")),
    trigger: v.union(
      v.literal("manual"),
      v.literal("pr_event"),
      v.literal("gate_trigger"),
      v.literal("scheduled"),
    ),
    taskType: v.string(),
    inputSummary: v.optional(v.string()),
    outputSummary: v.optional(v.string()),
    reviewStatus: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revised"),
      v.literal("rejected"),
    ),
    tokensUsed: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    modelId: v.optional(v.string()),
  })
    .index("by_program", ["programId"])
    .index("by_skill", ["skillId"])
    .index("by_org", ["orgId"])
    .index("by_task", ["taskId"]),

  // 9. Users — synced from Clerk via webhooks
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    orgIds: v.array(v.string()),
    role: v.optional(
      v.union(
        v.literal("admin"),
        v.literal("director"),
        v.literal("architect"),
        v.literal("developer"),
        v.literal("ba"),
        v.literal("qa"),
        v.literal("client"),
      ),
    ),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // 10. Team Members — program-level role assignments
  teamMembers: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    userId: v.id("users"),
    role: v.union(
      v.literal("director"),
      v.literal("architect"),
      v.literal("developer"),
      v.literal("ba"),
      v.literal("qa"),
      v.literal("client"),
    ),
    workstreamIds: v.optional(v.array(v.id("workstreams"))),
  })
    .index("by_program", ["programId"])
    .index("by_user", ["userId"]),

  // 11. Audit Log — immutable event log for compliance/history
  auditLog: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    entityType: v.string(),
    entityId: v.string(),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("status_change"),
    ),
    userId: v.id("users"),
    userName: v.string(),
    description: v.string(),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_entity", ["entityType", "entityId"]),

  // 12. Sprints — time-boxed iterations within a workstream
  sprints: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.id("workstreams"),
    name: v.string(),
    number: v.number(),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    goal: v.optional(v.string()),
    status: v.union(
      v.literal("planning"),
      v.literal("active"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  })
    .index("by_program", ["programId"])
    .index("by_workstream", ["workstreamId"])
    .index("by_org", ["orgId"]),

  // 13. Tasks — actionable work items linked to requirements/sprints
  tasks: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    sprintId: v.optional(v.id("sprints")),
    requirementId: v.optional(v.id("requirements")),
    title: v.string(),
    description: v.optional(v.string()),
    acceptanceCriteria: v.optional(v.array(v.string())),
    storyPoints: v.optional(v.number()),
    assigneeId: v.optional(v.id("users")),
    priority: v.union(
      v.literal("critical"),
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("review"),
      v.literal("done"),
    ),
    blockedBy: v.optional(v.array(v.id("tasks"))),
    dueDate: v.optional(v.number()),
    // Subtask decomposition fields (all optional — no migration needed)
    hasSubtasks: v.optional(v.boolean()),
    subtaskCount: v.optional(v.number()),
    subtasksCompleted: v.optional(v.number()),
    subtasksFailed: v.optional(v.number()),
    lastSubtaskActivity: v.optional(v.string()),
    // Subtask generation tracking
    subtaskGenerationStatus: v.optional(
      v.union(v.literal("processing"), v.literal("completed"), v.literal("error")),
    ),
    subtaskGenerationError: v.optional(v.string()),
    subtaskGenerationProgress: v.optional(v.string()),
    // Worktree branch reuse across sandbox sessions
    worktreeBranch: v.optional(v.string()),
    // Task verification pipeline
    verificationEnabled: v.optional(v.boolean()),
    // Design context pipeline — indicates a design snapshot was created for this task
    hasDesignSnapshot: v.optional(v.boolean()),
    // Repository bindings — references to sourceControlRepositories
    repositoryIds: v.optional(v.array(v.id("sourceControlRepositories"))),
    // Codebase analysis — implementation tracking
    implementationStatus: v.optional(
      v.union(
        v.literal("not_found"),
        v.literal("partially_implemented"),
        v.literal("fully_implemented"),
        v.literal("needs_verification"),
      ),
    ),
    implementationConfidence: v.optional(v.number()),
    lastAnalyzedAt: v.optional(v.number()),
    lastAnalysisRunId: v.optional(v.id("codebaseAnalysisRuns")),
  })
    .index("by_program", ["programId"])
    .index("by_workstream", ["workstreamId"])
    .index("by_sprint", ["sprintId"])
    .index("by_org", ["orgId"])
    .index("by_assignee", ["assigneeId"]),

  // 14. Integrations — third-party system connections tracked per program
  integrations: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    type: v.union(
      v.literal("api"),
      v.literal("webhook"),
      v.literal("file_transfer"),
      v.literal("database"),
      v.literal("middleware"),
      v.literal("other"),
    ),
    sourceSystem: v.string(),
    targetSystem: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("planned"),
      v.literal("in_progress"),
      v.literal("testing"),
      v.literal("live"),
      v.literal("deprecated"),
    ),
    requirementIds: v.optional(v.array(v.id("requirements"))),
    ownerId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"]),

  // 15. Documents — file attachments at the program level
  documents: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    storageId: v.optional(v.id("_storage")),
    externalObjectUrl: v.optional(v.string()),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    category: v.union(
      v.literal("architecture"),
      v.literal("requirements"),
      v.literal("testing"),
      v.literal("deployment"),
      v.literal("meeting_notes"),
      v.literal("other"),
    ),
    description: v.optional(v.string()),
    uploadedBy: v.id("users"),
    // Discovery Accelerator extensions
    analysisStatus: v.optional(
      v.union(
        v.literal("none"),
        v.literal("queued"),
        v.literal("analyzing"),
        v.literal("complete"),
        v.literal("failed"),
      ),
    ),
    analysisError: v.optional(v.string()),
    latestAnalysisId: v.optional(v.id("documentAnalyses")),
    mimeType: v.optional(v.string()),
    pageCount: v.optional(v.number()),
    // Google Drive import extensions
    source: v.optional(v.union(v.literal("upload"), v.literal("google_drive"))),
    driveFileId: v.optional(v.string()),
    driveFileName: v.optional(v.string()),
    driveMimeType: v.optional(v.string()),
    driveWebViewLink: v.optional(v.string()),
    driveModifiedTime: v.optional(v.string()),
    driveVersion: v.optional(v.string()),
    driveContentHash: v.optional(v.string()),
    importedByCredentialId: v.optional(v.id("googleDriveCredentials")),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_org_drive_file", ["orgId", "driveFileId"])
    .index("by_program_drive_file", ["programId", "driveFileId"]),

  // ── Design Context Pipeline ─────────────────────────────────────

  designAssets: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    workstreamId: v.optional(v.id("workstreams")),
    requirementId: v.optional(v.id("requirements")),
    name: v.string(),
    type: v.union(
      v.literal("screenshot"),
      v.literal("tokens"),
      v.literal("styleGuide"),
      v.literal("prototype"),
      v.literal("interactionSpec"),
      v.literal("animationSnippet"),
    ),
    fileId: v.optional(v.id("_storage")),
    externalUrl: v.optional(v.string()),
    content: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    version: v.number(),
    parentVersionId: v.optional(v.id("designAssets")),
    status: v.union(
      v.literal("uploaded"),
      v.literal("analyzing"),
      v.literal("analyzed"),
      v.literal("error"),
    ),
    analysisError: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_program", ["orgId", "programId"])
    .index("by_workstream", ["orgId", "programId", "workstreamId"])
    .index("by_requirement", ["orgId", "programId", "requirementId"])
    .index("by_type", ["orgId", "programId", "type"]),

  designAnalyses: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    designAssetId: v.id("designAssets"),
    structuredSpec: v.string(),
    markdownSummary: v.string(),
    extractedColors: v.optional(
      v.array(
        v.object({
          name: v.string(),
          hex: v.string(),
          usage: v.string(),
        }),
      ),
    ),
    extractedTypography: v.optional(
      v.array(
        v.object({
          role: v.string(),
          fontFamily: v.string(),
          fontSize: v.string(),
          fontWeight: v.string(),
          lineHeight: v.optional(v.string()),
        }),
      ),
    ),
    extractedComponents: v.optional(
      v.array(
        v.object({
          name: v.string(),
          type: v.string(),
          description: v.string(),
          boundingBox: v.optional(
            v.object({
              x: v.number(),
              y: v.number(),
              width: v.number(),
              height: v.number(),
            }),
          ),
          codeMatch: v.optional(
            v.object({
              filePath: v.string(),
              componentName: v.string(),
              confidence: v.number(),
            }),
          ),
        }),
      ),
    ),
    extractedLayout: v.optional(
      v.object({
        type: v.string(),
        columns: v.optional(v.number()),
        spacing: v.optional(v.string()),
        responsive: v.optional(v.string()),
      }),
    ),
    model: v.string(),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cacheReadTokens: v.optional(v.number()),
    cacheCreationTokens: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    analyzedAt: v.number(),
  })
    .index("by_asset", ["designAssetId"])
    .index("by_program", ["orgId", "programId"]),

  designTokenSets: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    version: v.number(),
    colors: v.optional(v.string()),
    typography: v.optional(v.string()),
    spacing: v.optional(v.string()),
    breakpoints: v.optional(v.string()),
    shadows: v.optional(v.string()),
    radii: v.optional(v.string()),
    tailwindConfig: v.optional(v.string()),
    cssVariables: v.optional(v.string()),
    scssVariables: v.optional(v.string()),
    jsonTokens: v.optional(v.string()),
    sourceType: v.union(
      v.literal("manual"),
      v.literal("figma"),
      v.literal("extracted"),
      v.literal("imported"),
    ),
    sourceAssetId: v.optional(v.id("designAssets")),
  }).index("by_program", ["orgId", "programId"]),

  designInteractions: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    designAssetId: v.optional(v.id("designAssets")),
    componentName: v.string(),
    trigger: v.string(),
    animationType: v.string(),
    duration: v.optional(v.string()),
    easing: v.optional(v.string()),
    description: v.string(),
    codeSnippet: v.optional(v.string()),
    snippetLanguage: v.optional(v.string()),
    recordingFileId: v.optional(v.id("_storage")),
  })
    .index("by_program", ["orgId", "programId"])
    .index("by_asset", ["designAssetId"]),

  taskDesignSnapshots: defineTable({
    orgId: v.string(),
    taskId: v.id("tasks"),
    programId: v.id("programs"),
    resolvedTokens: v.string(),
    resolvedComponents: v.string(),
    screenSpecs: v.optional(v.string()),
    interactionSpecs: v.optional(v.string()),
    codeArtifacts: v.optional(v.string()),
    assetIds: v.array(v.id("designAssets")),
    tokenSetId: v.optional(v.id("designTokenSets")),
    snapshotVersion: v.number(),
    degraded: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_program", ["orgId", "programId"]),

  designFidelityChecks: defineTable({
    orgId: v.string(),
    taskId: v.id("tasks"),
    programId: v.id("programs"),
    referenceImageId: v.id("_storage"),
    outputImageId: v.id("_storage"),
    diffImageId: v.optional(v.id("_storage")),
    structuralScore: v.number(),
    pixelScore: v.optional(v.number()),
    overallScore: v.number(),
    deviations: v.optional(
      v.array(
        v.object({
          area: v.string(),
          severity: v.union(v.literal("minor"), v.literal("moderate"), v.literal("major")),
          description: v.string(),
        }),
      ),
    ),
    checkedAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_program", ["orgId", "programId"]),

  // 16. Playbooks — reusable migration playbook templates
  playbooks: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    name: v.string(),
    description: v.optional(v.string()),
    targetPlatform: v.union(
      v.literal("salesforce_b2b"),
      v.literal("bigcommerce_b2b"),
      v.literal("sitecore"),
      v.literal("wordpress"),
      v.literal("none"),
      v.literal("platform_agnostic"),
    ),
    steps: v.array(
      v.object({
        title: v.string(),
        description: v.optional(v.string()),
        workstreamId: v.optional(v.id("workstreams")),
        estimatedHours: v.optional(v.number()),
      }),
    ),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"]),

  // 17. Playbook Instances — instantiated playbooks with generated tasks
  playbookInstances: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    playbookId: v.id("playbooks"),
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled")),
    generatedTaskIds: v.optional(v.array(v.id("tasks"))),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_program", ["programId"])
    .index("by_playbook", ["playbookId"])
    .index("by_org", ["orgId"]),

  // 18. Workstream Dependencies — cross-workstream dependency tracking
  workstreamDependencies: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    sourceWorkstreamId: v.id("workstreams"),
    targetWorkstreamId: v.id("workstreams"),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("resolved"),
      v.literal("blocked"),
      v.literal("suggested"),
      v.literal("approved"),
    ),
    // Phase 2: AI-powered dependency detection fields
    dependencyType: v.optional(
      v.union(v.literal("blocks"), v.literal("enables"), v.literal("conflicts")),
    ),
    suggestedBy: v.optional(v.union(v.literal("manual"), v.literal("ai"))),
    aiConfidence: v.optional(v.number()),
    requirementIds: v.optional(v.array(v.id("requirements"))),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
  })
    .index("by_program", ["programId"])
    .index("by_source", ["sourceWorkstreamId"])
    .index("by_target", ["targetWorkstreamId"])
    .index("by_org_status", ["orgId", "status"]),

  // 19. Comments — threaded discussions on any entity
  comments: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    entityType: v.union(
      v.literal("requirement"),
      v.literal("risk"),
      v.literal("task"),
      v.literal("skill"),
      v.literal("gate"),
      v.literal("integration"),
    ),
    entityId: v.string(),
    authorId: v.id("users"),
    content: v.string(),
    parentId: v.optional(v.id("comments")),
  })
    .index("by_entity", ["entityType", "entityId"])
    .index("by_org", ["orgId"]),

  // 20. Evidence — file attachments linked to requirements
  evidence: defineTable({
    orgId: v.string(),
    requirementId: v.id("requirements"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    uploadedBy: v.id("users"),
  }).index("by_requirement", ["requirementId"]),

  // 21. Document Analyses — AI analysis results per uploaded document
  documentAnalyses: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    documentId: v.id("documents"),
    status: v.union(
      v.literal("queued"),
      v.literal("extracting"),
      v.literal("analyzing"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    extractedText: v.optional(v.string()),
    tokenCount: v.optional(v.number()),
    findings: v.optional(v.any()),
    error: v.optional(v.string()),
    claudeModelId: v.optional(v.string()),
    claudeRequestId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    cacheReadTokens: v.optional(v.number()),
    cacheCreationTokens: v.optional(v.number()),
    analysisVersion: v.number(),
    durationMs: v.optional(v.number()),
  })
    .index("by_document", ["documentId"])
    .index("by_program", ["programId"])
    .index("by_status", ["programId", "status"]),

  // 22a. Analysis Activity Logs — real-time progress entries for document analysis
  analysisActivityLogs: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    analysisId: v.id("documentAnalyses"),
    step: v.string(),
    message: v.string(),
    detail: v.optional(v.string()),
    level: v.union(v.literal("info"), v.literal("success"), v.literal("error")),
  })
    .index("by_analysis", ["analysisId"])
    .index("by_program", ["programId"]),

  // 22b. Presence — live page presence heartbeat for collaboration
  presence: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    page: v.string(),
    userId: v.id("users"),
    userName: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_program", ["programId"])
    .index("by_program_page", ["programId", "page"])
    .index("by_program_page_user", ["programId", "page", "userId"]),

  // 22c. Activity Events — real-time feed events for Discovery Hub
  activityEvents: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    page: v.optional(v.string()),
    eventType: v.string(),
    message: v.string(),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    userId: v.id("users"),
    userName: v.string(),
    createdAt: v.number(),
  })
    .index("by_program_createdAt", ["programId", "createdAt"])
    .index("by_program_type_createdAt", ["programId", "eventType", "createdAt"])
    .index("by_org_createdAt", ["orgId", "createdAt"]),

  // 22. Discovery Findings — AI-extracted items awaiting human review
  discoveryFindings: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    analysisId: v.union(v.id("documentAnalyses"), v.id("videoAnalyses")),
    documentId: v.id("documents"),
    type: videoFindingTypeValidator,
    status: findingReviewStatusValidator,
    data: v.any(),
    suggestedWorkstream: v.optional(v.string()),
    confidence: findingConfidenceValidator,
    sourceExcerpt: v.optional(v.string()),
    sourceAttribution: v.optional(optionalVideoFindingAttributionValidator),
    importedAs: v.optional(v.any()),
    editedData: v.optional(v.any()),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_analysis", ["analysisId"])
    .index("by_program_type", ["programId", "type"])
    .index("by_program_status", ["programId", "status"])
    .index("by_document", ["documentId"]),

  // 23. Daily Digest Cache — cached AI-generated daily briefings per user
  dailyDigestCache: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    userId: v.string(),
    lastVisitTime: v.number(),
    digest: v.string(),
    metadata: v.object({
      auditLogsAnalyzed: v.number(),
      changeCount: v.number(),
      workstreamsAffected: v.number(),
      tokensUsed: v.number(),
    }),
    expiresAt: v.number(),
  })
    .index("by_org_user", ["orgId", "userId"])
    .index("by_program_user", ["programId", "userId"]),

  // 24. AI Health Scores — AI-computed workstream health assessments
  aiHealthScores: defineTable({
    orgId: v.string(),
    workstreamId: v.id("workstreams"),
    health: v.union(v.literal("on_track"), v.literal("at_risk"), v.literal("blocked")),
    healthScore: v.number(),
    reasoning: v.string(),
    factors: v.object({
      velocityScore: v.number(),
      taskAgingScore: v.number(),
      riskScore: v.number(),
      gatePassRate: v.number(),
      dependencyScore: v.number(),
    }),
    previousHealth: v.optional(
      v.union(v.literal("on_track"), v.literal("at_risk"), v.literal("blocked")),
    ),
    changeReason: v.optional(v.string()),
    scheduledAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_workstream", ["workstreamId"])
    .index("by_org", ["orgId"]),

  // ═══════════════════════════════════════════════════════════════════
  // Phase 3: Continuous Discovery & Sprint AI tables
  // ═══════════════════════════════════════════════════════════════════

  // 25. Refinement Suggestions — AI-generated requirement improvement suggestions
  refinementSuggestions: defineTable({
    orgId: v.string(),
    requirementId: v.id("requirements"),
    programId: v.id("programs"),
    suggestions: v.optional(v.any()),
    status: v.union(
      v.literal("processing"),
      v.literal("pending"),
      v.literal("applied"),
      v.literal("dismissed"),
      v.literal("error"),
    ),
    createdAt: v.number(),
    totalTokensUsed: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_requirement", ["requirementId"])
    .index("by_program", ["programId"]),

  // 26. Task Decompositions — AI-generated task breakdowns from requirements
  taskDecompositions: defineTable({
    orgId: v.string(),
    requirementId: v.id("requirements"),
    programId: v.id("programs"),
    decomposition: v.optional(v.any()),
    status: v.union(
      v.literal("processing"),
      v.literal("pending_review"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("error"),
    ),
    createdAt: v.number(),
    thinkingTokens: v.optional(v.number()),
    totalTokensUsed: v.optional(v.number()),
    error: v.optional(v.string()),
    generationProgress: v.optional(v.string()),
  })
    .index("by_requirement", ["requirementId"])
    .index("by_program", ["programId"]),

  // 27. Sprint Planning Recommendations — AI-generated sprint composition advice
  sprintPlanningRecommendations: defineTable({
    orgId: v.string(),
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
    recommendation: v.optional(v.any()),
    status: v.union(
      v.literal("processing"),
      v.literal("pending"),
      v.literal("applied"),
      v.literal("revised"),
      v.literal("error"),
    ),
    createdAt: v.number(),
    totalTokensUsed: v.optional(v.number()),
    generationProgress: v.optional(v.string()),
    error: v.optional(v.string()),
    recommendationType: v.optional(v.union(v.literal("sprint_plan"), v.literal("branch_strategy"))),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_program", ["programId"]),

  // 28. Risk Assessments — AI-generated risk evaluations from context changes
  riskAssessments: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    assessment: v.any(),
    changeType: v.string(),
    status: v.union(v.literal("completed"), v.literal("error")),
    createdAt: v.number(),
    totalTokensUsed: v.number(),
  }).index("by_program", ["programId"]),

  // 29. Sprint Gate Evaluations — AI-assisted gate readiness assessments
  sprintGateEvaluations: defineTable({
    orgId: v.string(),
    sprintId: v.id("sprints"),
    programId: v.id("programs"),
    evaluation: v.any(),
    status: v.union(v.literal("completed"), v.literal("error")),
    createdAt: v.number(),
    totalTokensUsed: v.number(),
  })
    .index("by_sprint", ["sprintId"])
    .index("by_program", ["programId"]),

  // ═══════════════════════════════════════════════════════════════════
  // Phase 7: Video Call Analysis tables
  // ═══════════════════════════════════════════════════════════════════

  // 30. Video Analyses — pipeline tracking for uploaded call recordings
  videoAnalyses: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    documentId: v.id("documents"),
    status: videoAnalysisStatusValidator,
    failedStage: v.optional(v.string()),
    failedError: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    videoUrl: v.string(),
    videoSizeBytes: v.number(),
    videoDurationMs: v.optional(v.number()),
    mimeType: v.string(),
    audioFileUrl: v.optional(v.string()),
    transcriptId: v.optional(v.id("videoTranscripts")),
    frameExtractionId: v.optional(v.id("videoFrameExtractions")),
    tlIndexId: v.optional(v.string()),
    tlVideoId: v.optional(v.string()),
    tlTaskId: v.optional(v.string()),
    tlSummary: v.optional(v.string()),
    tlChapters: v.optional(v.array(v.any())),
    tlTopics: v.optional(v.array(v.string())),
    tlGist: v.optional(v.any()),
    speakerMappingComplete: v.boolean(),
    retentionPolicy: videoRetentionPolicyValidator,
    retentionExpiresAt: v.optional(v.number()),
    retentionStatus: v.optional(v.union(v.literal("active"), v.literal("expired"))),
    retentionCleanupAt: v.optional(v.number()),
    retentionMetadata: v.optional(
      v.object({
        rawAssetState: v.union(v.literal("active"), v.literal("expired")),
        lastCleanupReason: v.optional(v.string()),
      }),
    ),
    analysisVersion: v.number(),
    stageTimestamps: v.optional(
      v.object({
        uploadingAt: v.optional(v.number()),
        indexingAt: v.optional(v.number()),
        // Legacy timestamp fields kept for existing analyses until backfilled.
        extractingAt: v.optional(v.number()),
        transcribingAt: v.optional(v.number()),
        classifyingFramesAt: v.optional(v.number()),
        awaitingSpeakersAt: v.optional(v.number()),
        analyzingAt: v.optional(v.number()),
        synthesizingAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        failedAt: v.optional(v.number()),
      }),
    ),
    totalTokensUsed: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    segmentOutputs: v.optional(v.array(v.any())),
    synthesisOutput: v.optional(v.any()),
  })
    .index("by_document", ["documentId"])
    .index("by_program", ["programId"])
    .index("by_status", ["programId", "status"])
    .index("by_retention", ["retentionExpiresAt"]),

  // 30a. Twelve Labs Indexes — one index reference per organization
  twelveLabsIndexes: defineTable({
    orgId: v.string(),
    indexId: v.string(),
    indexName: v.string(),
    createdAt: v.number(),
  }).index("by_org", ["orgId"]),

  // 30b. Video Activity Logs — real-time progress entries for video analysis
  videoActivityLogs: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    analysisId: v.id("videoAnalyses"),
    step: v.string(),
    message: v.string(),
    detail: v.optional(v.string()),
    level: v.union(v.literal("info"), v.literal("success"), v.literal("error")),
  })
    .index("by_analysis", ["analysisId"])
    .index("by_program", ["programId"]),

  // 31. Video Transcripts — diarized transcript payloads per analysis
  videoTranscripts: defineTable({
    orgId: v.string(),
    videoAnalysisId: v.id("videoAnalyses"),
    transcriptionService: v.string(),
    language: v.string(),
    totalDurationMs: v.number(),
    speakerCount: v.number(),
    utterances: v.array(
      v.object({
        speakerId: v.string(),
        startMs: v.number(),
        endMs: v.number(),
        text: v.string(),
        confidence: v.optional(v.number()),
      }),
    ),
    speakerMapping: v.optional(
      v.array(
        v.object({
          speakerId: v.string(),
          name: v.string(),
          role: v.optional(v.string()),
          userId: v.optional(v.id("users")),
          isExternal: v.optional(v.boolean()),
        }),
      ),
    ),
    fullText: v.string(),
    wordCount: v.number(),
    retentionExpiredAt: v.optional(v.number()),
    segments: v.optional(
      v.array(
        v.object({
          index: v.number(),
          startMs: v.number(),
          endMs: v.number(),
          topic: v.optional(v.string()),
          summary: v.optional(v.string()),
        }),
      ),
    ),
  })
    .index("by_video_analysis", ["videoAnalysisId"])
    .index("by_org", ["orgId"]),

  // 32. Video Frame Extractions — keyframes and frame classifications
  videoFrameExtractions: defineTable({
    orgId: v.string(),
    videoAnalysisId: v.id("videoAnalyses"),
    totalFramesExtracted: v.number(),
    uniqueKeyframes: v.number(),
    classifiedFrames: v.array(
      v.object({
        timestampMs: v.number(),
        frameUrl: v.string(),
        category: v.string(),
        description: v.optional(v.string()),
        confidence: v.optional(v.number()),
      }),
    ),
    screenShareSegments: v.array(
      v.object({
        startMs: v.number(),
        endMs: v.number(),
        keyframeCount: v.optional(v.number()),
      }),
    ),
    webcamOnlyPercent: v.number(),
    pass1TokensUsed: v.number(),
    pass2TokensUsed: v.number(),
    retentionExpiredAt: v.optional(v.number()),
  })
    .index("by_video_analysis", ["videoAnalysisId"])
    .index("by_org", ["orgId"]),

  // 33. Video Findings — video-sourced findings with source attribution
  videoFindings: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    videoAnalysisId: v.id("videoAnalyses"),
    documentId: v.id("documents"),
    type: videoFindingTypeValidator,
    status: findingReviewStatusValidator,
    data: v.any(),
    sourceTimestamp: v.number(),
    sourceTimestampEnd: v.optional(v.number()),
    sourceExcerpt: v.string(),
    sourceSpeaker: v.optional(videoSourceSpeakerValidator),
    sourceKeyframeUrls: v.optional(v.array(v.string())),
    sourceAttribution: v.optional(videoFindingAttributionValidator),
    confidence: findingConfidenceValidator,
    segmentIndex: v.optional(v.number()),
    synthesisNote: v.optional(v.string()),
    suggestedWorkstream: v.optional(v.string()),
    importedAs: v.optional(v.any()),
  })
    .index("by_video_analysis", ["videoAnalysisId"])
    .index("by_program_type", ["programId", "type"])
    .index("by_program_status", ["programId", "status"])
    .index("by_document", ["documentId"]),

  // 34. Visual Discovery Artifacts — generated visual gallery outputs
  visualDiscoveryArtifacts: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    videoAnalysisId: v.id("videoAnalyses"),
    title: v.string(),
    sections: v.array(
      v.object({
        title: v.string(),
        summary: v.optional(v.string()),
        startMs: v.optional(v.number()),
        endMs: v.optional(v.number()),
        keyframes: v.array(
          v.object({
            timestampMs: v.number(),
            imageUrl: v.string(),
            caption: v.optional(v.string()),
            linkedFindingIds: v.optional(v.array(v.id("videoFindings"))),
          }),
        ),
      }),
    ),
    totalKeyframes: v.number(),
    generatedAt: v.number(),
  })
    .index("by_video_analysis", ["videoAnalysisId"])
    .index("by_program", ["programId"]),

  // ═══════════════════════════════════════════════════════════════════
  // Phase 6: Deep GitHub Integration tables
  // ═══════════════════════════════════════════════════════════════════

  // 35. Source Control Installations — Provider installations per Clerk organization
  sourceControlInstallations: defineTable({
    orgId: v.string(),
    providerType: v.literal("github"),
    installationId: v.string(),
    accountLogin: v.string(),
    accountType: v.union(v.literal("organization"), v.literal("user")),
    status: v.union(v.literal("active"), v.literal("suspended"), v.literal("disconnected")),
    permissions: v.any(),
    installedAt: v.number(),
    disconnectedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_installation", ["installationId"]),

  // 36. Source Control Repositories — Repositories linked to programs
  sourceControlRepositories: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    installationId: v.string(),
    providerType: v.literal("github"),
    repoFullName: v.string(),
    providerRepoId: v.string(),
    defaultBranch: v.string(),
    language: v.optional(v.string()),
    role: v.union(
      v.literal("storefront"),
      v.literal("integration"),
      v.literal("data_migration"),
      v.literal("infrastructure"),
      v.literal("extension"),
      v.literal("documentation"),
    ),
    isMonorepo: v.boolean(),
    pathFilters: v.optional(v.array(v.string())),
    localPath: v.optional(v.string()),
    deployWorkflowNames: v.optional(v.array(v.string())),
  })
    .index("by_program", ["programId"])
    .index("by_repo", ["repoFullName"])
    .index("by_org", ["orgId"]),

  // 37. Source Control Events — Raw webhook event buffer
  sourceControlEvents: defineTable({
    orgId: v.string(),
    providerType: v.string(),
    eventType: v.string(),
    action: v.optional(v.string()),
    entityType: v.string(),
    entityId: v.string(),
    payload: v.any(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("filtered"),
      v.literal("failed"),
    ),
    processedAt: v.optional(v.number()),
    retryCount: v.number(),
    receivedAt: v.number(),
  })
    .index("by_status", ["status", "receivedAt"])
    .index("by_entity", ["entityType", "entityId", "status"]),

  // 38. Source Control Issue Mappings — Task to GitHub Issue mappings
  sourceControlIssueMappings: defineTable({
    orgId: v.string(),
    taskId: v.id("tasks"),
    repositoryId: v.id("sourceControlRepositories"),
    issueNumber: v.number(),
    issueUrl: v.string(),
    syncStatus: v.union(
      v.literal("synced"),
      v.literal("pending"),
      v.literal("conflict"),
      v.literal("error"),
    ),
    lastSyncedAt: v.number(),
    lastExternalEditAt: v.optional(v.number()),
  })
    .index("by_task", ["taskId"])
    .index("by_issue", ["repositoryId", "issueNumber"]),

  // 39. Source Control Pull Requests — PRs tracked with platform-relevant metadata
  sourceControlPullRequests: defineTable({
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    prNumber: v.number(),
    taskId: v.optional(v.id("tasks")),
    linkMethod: v.optional(
      v.union(
        v.literal("branch_name"),
        v.literal("body_reference"),
        v.literal("commit_message"),
        v.literal("ai_inference"),
        v.literal("manual"),
      ),
    ),
    linkConfidence: v.optional(v.number()),
    title: v.string(),
    body: v.optional(v.string()),
    state: v.union(v.literal("open"), v.literal("closed"), v.literal("merged")),
    isDraft: v.boolean(),
    authorLogin: v.string(),
    sourceBranch: v.string(),
    targetBranch: v.string(),
    reviewState: v.union(
      v.literal("none"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("changes_requested"),
    ),
    ciStatus: v.union(
      v.literal("none"),
      v.literal("passing"),
      v.literal("failing"),
      v.literal("pending"),
    ),
    commitCount: v.number(),
    filesChanged: v.number(),
    additions: v.number(),
    deletions: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    mergedAt: v.optional(v.number()),
    providerUrl: v.string(),
    // PR lifecycle fields
    mergeStrategy: v.optional(
      v.union(v.literal("squash"), v.literal("merge"), v.literal("rebase")),
    ),
    stackOrder: v.optional(v.number()),
    parentPrId: v.optional(v.id("sourceControlPullRequests")),
    conflictState: v.optional(
      v.union(v.literal("clean"), v.literal("conflicted"), v.literal("unknown")),
    ),
    conflictFiles: v.optional(v.array(v.string())),
    aiDescriptionEnabled: v.optional(v.boolean()),
  })
    .index("by_task", ["taskId"])
    .index("by_repo", ["repositoryId", "state"])
    .index("by_org", ["orgId"])
    .index("by_repo_pr", ["repositoryId", "prNumber"])
    .index("by_repo_state_branch", ["repositoryId", "state", "sourceBranch"])
    .index("by_parent_pr", ["parentPrId"]),

  // 40. Source Control Commits — Commits linked to tasks/PRs
  sourceControlCommits: defineTable({
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    sha: v.string(),
    prId: v.optional(v.id("sourceControlPullRequests")),
    taskId: v.optional(v.id("tasks")),
    authorLogin: v.string(),
    message: v.string(),
    filesChanged: v.number(),
    additions: v.number(),
    deletions: v.number(),
    committedAt: v.number(),
  })
    .index("by_pr", ["prId"])
    .index("by_repo_date", ["repositoryId", "committedAt"])
    .index("by_sha", ["sha"]),

  // 41. Source Control Deployments — Deployment tracking
  sourceControlDeployments: defineTable({
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    programId: v.id("programs"),
    environment: v.string(),
    rawEnvironment: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("success"),
      v.literal("failure"),
      v.literal("error"),
      v.literal("inactive"),
    ),
    sha: v.string(),
    ref: v.string(),
    providerDeploymentId: v.optional(v.number()),
    deployedBy: v.optional(v.string()),
    deployedAt: v.number(),
    completedAt: v.optional(v.number()),
    relatedPRNumbers: v.optional(v.array(v.number())),
    relatedTaskIds: v.optional(v.array(v.id("tasks"))),
    manualPRAdjustments: v.optional(
      v.object({
        added: v.array(v.number()),
        removed: v.array(v.number()),
      }),
    ),
    workflowRunId: v.optional(v.number()),
    workflowName: v.optional(v.string()),
    durationMs: v.optional(v.number()),
  })
    .index("by_program_env", ["programId", "environment"])
    .index("by_repo", ["repositoryId"])
    .index("by_sha", ["sha"]),

  // 42. Source Control Reviews — AI code review results
  sourceControlReviews: defineTable({
    orgId: v.string(),
    prId: v.id("sourceControlPullRequests"),
    taskId: v.optional(v.id("tasks")),
    requestedBy: v.string(),
    triggerMethod: v.union(
      v.literal("platform_button"),
      v.literal("github_comment"),
      v.literal("bulk_review"),
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    result: v.optional(v.any()),
    githubReviewId: v.optional(v.number()),
    tokenUsage: v.optional(v.any()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_pr", ["prId"])
    .index("by_org_date", ["orgId", "createdAt"]),

  // 43. Source Control Sync State — Per-repo sync tracking
  sourceControlSyncState: defineTable({
    orgId: v.string(),
    repositoryId: v.id("sourceControlRepositories"),
    lastWebhookAt: v.optional(v.number()),
    lastReconciliationAt: v.optional(v.number()),
    reconciliationCorrections: v.number(),
    status: v.union(v.literal("healthy"), v.literal("stale"), v.literal("error")),
  })
    .index("by_repo", ["repositoryId"])
    .index("by_status", ["status"]),

  // 44. Source Control Token Cache — Installation token cache
  sourceControlTokenCache: defineTable({
    installationId: v.string(),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_installation", ["installationId"]),

  // 45. AI Model Cache — cached model lists from providers
  aiModelCache: defineTable({
    provider: v.string(),
    models: v.array(
      v.object({
        id: v.string(),
        displayName: v.string(),
      }),
    ),
    fetchedAt: v.number(),
    expiresAt: v.number(),
  }).index("by_provider", ["provider"]),

  // 46. Code Snippets — Anonymized code patterns from completed programs
  codeSnippets: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    title: v.string(),
    description: v.string(),
    code: v.string(),
    annotations: v.optional(v.string()),
    requirementCategory: v.string(),
    targetPlatform: v.union(
      v.literal("salesforce_b2b"),
      v.literal("bigcommerce_b2b"),
      v.literal("sitecore"),
      v.literal("wordpress"),
      v.literal("none"),
      v.literal("platform_agnostic"),
    ),
    language: v.string(),
    successRating: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    complexity: v.optional(v.any()),
    upvotes: v.number(),
    flagCount: v.number(),
    createdAt: v.number(),
  })
    .index("by_program", ["programId"])
    .index("by_platform", ["targetPlatform"])
    .index("by_category", ["requirementCategory"]),

  // 46. Source Control Retry Queue — Failed operations pending retry
  sourceControlRetryQueue: defineTable({
    orgId: v.string(),
    operationType: v.string(),
    payload: v.any(),
    retryCount: v.number(),
    nextRetryAt: v.number(),
    lastError: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("retrying"),
      v.literal("succeeded"),
      v.literal("abandoned"),
    ),
    maxRetries: v.number(),
    createdAt: v.number(),
  }).index("by_status_retry", ["status", "nextRetryAt"]),

  // 47. Atlassian Connections — OAuth credentials + Jira/Confluence bindings
  atlassianConnections: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    atlassianSiteId: v.optional(v.string()),
    atlassianSiteUrl: v.optional(v.string()),
    accessTokenEncrypted: v.optional(v.string()),
    refreshTokenEncrypted: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    scopes: v.optional(v.array(v.string())),
    jiraProjectId: v.optional(v.string()),
    jiraProjectKey: v.optional(v.string()),
    confluenceSpaceKey: v.optional(v.string()),
    confluenceParentPageId: v.optional(v.string()),
    status: v.union(v.literal("connected"), v.literal("disconnected"), v.literal("setup_required")),
    lastSyncAt: v.optional(v.number()),
    webhookIds: v.optional(
      v.object({
        jiraWebhookId: v.optional(v.string()),
        confluenceWebhookId: v.optional(v.string()),
        jiraSecretEncrypted: v.optional(v.string()),
        confluenceSecretEncrypted: v.optional(v.string()),
      }),
    ),
    connectedBy: v.optional(v.id("users")),
    oauthState: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    connectedAt: v.optional(v.number()),
    disconnectedAt: v.optional(v.number()),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_site_id", ["atlassianSiteId"])
    .index("by_status", ["status", "updatedAt"])
    .index("by_oauth_state", ["oauthState"]),

  // 48. Jira Sync Records — platform entity to Jira mapping
  jiraSyncRecords: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    platformEntityType: v.union(
      v.literal("workstream"),
      v.literal("requirement"),
      v.literal("task"),
      v.literal("sprint"),
    ),
    platformEntityId: v.string(),
    jiraIssueId: v.optional(v.string()),
    jiraIssueKey: v.optional(v.string()),
    jiraSprintId: v.optional(v.number()),
    jiraIssueType: v.optional(v.string()),
    syncDirection: v.union(v.literal("push"), v.literal("pull"), v.literal("bidirectional")),
    lastPushAt: v.optional(v.number()),
    lastPullAt: v.optional(v.number()),
    jiraLastModified: v.optional(v.string()),
    platformLastModified: v.optional(v.number()),
    conflictStatus: v.optional(
      v.union(v.literal("none"), v.literal("detected"), v.literal("resolved")),
    ),
    conflictDetails: v.optional(v.string()),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_jira_issue_key", ["programId", "jiraIssueKey"])
    .index("by_platform_entity", ["programId", "platformEntityType", "platformEntityId"]),

  // 49. Confluence Page Records — publish and ingestion tracking
  confluencePageRecords: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    pageType: v.union(
      v.literal("gap_analysis"),
      v.literal("sprint_report"),
      v.literal("risk_register"),
      v.literal("visual_discovery"),
      v.literal("decisions_log"),
      v.literal("program_overview"),
      v.literal("ingested"),
    ),
    confluencePageId: v.string(),
    confluencePageTitle: v.string(),
    confluenceVersion: v.number(),
    direction: v.union(v.literal("publish"), v.literal("ingest")),
    lastPublishedAt: v.optional(v.number()),
    lastIngestedAt: v.optional(v.number()),
    sourceAnalysisId: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    sprintId: v.optional(v.string()),
    cachedRenderedHtml: v.optional(v.string()),
    cachedRenderedVersion: v.optional(v.number()),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_confluence_page_id", ["programId", "confluencePageId"])
    .index("by_page_type", ["programId", "pageType"]),

  // 50. Jira Sync Queue — approval queue and execution pipeline
  jiraSyncQueue: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    operationType: v.union(
      v.literal("create_issue"),
      v.literal("update_issue"),
      v.literal("create_sprint"),
      v.literal("transition_issue"),
      v.literal("add_comment"),
    ),
    payload: v.any(),
    platformEntityId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("executed"),
    ),
    createdAt: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    jiraResponse: v.optional(v.any()),
  })
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_status", ["status", "createdAt"]),

  // 51. Atlassian Webhook Events — queue for Jira/Confluence inbound events
  atlassianWebhookEvents: defineTable({
    orgId: v.string(),
    programId: v.optional(v.id("programs")),
    providerType: v.union(v.literal("jira"), v.literal("confluence")),
    atlassianSiteId: v.optional(v.string()),
    eventType: v.string(),
    action: v.optional(v.string()),
    entityType: v.string(),
    entityId: v.string(),
    payload: v.any(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("filtered"),
      v.literal("failed"),
    ),
    retryCount: v.number(),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  })
    .index("by_status", ["status", "receivedAt"])
    .index("by_program", ["programId", "receivedAt"])
    .index("by_org", ["orgId", "receivedAt"])
    .index("by_entity", ["providerType", "entityType", "entityId", "status"]),

  // 52a. Sandbox Configs — org-level Claude + workspace configuration
  sandboxConfigs: defineTable({
    orgId: v.string(),
    claudeSettings: v.any(),
    hooks: v.object({
      preToolUse: v.array(v.any()),
      postToolUse: v.array(v.any()),
      stop: v.array(v.any()),
      notification: v.array(v.any()),
      error: v.array(v.any()),
      gitOperation: v.array(v.any()),
      fileChange: v.array(v.any()),
      testResult: v.array(v.any()),
    }),
    mcpServers: v.array(
      v.object({
        name: v.string(),
        package: v.string(),
        config: v.any(),
        level: v.union(v.literal("global"), v.literal("project"), v.literal("task")),
      }),
    ),
    dotfiles: v.array(
      v.object({
        path: v.string(),
        content: v.string(),
      }),
    ),
    shellAliases: v.array(
      v.object({
        name: v.string(),
        command: v.string(),
      }),
    ),
    devToolConfigs: v.array(
      v.object({
        tool: v.string(),
        config: v.string(),
      }),
    ),
    setupScripts: v.array(
      v.object({
        name: v.string(),
        script: v.string(),
        runOrder: v.number(),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_org", ["orgId"]),

  // 52b. Env Vault — encrypted org-level secret storage
  envVault: defineTable({
    orgId: v.string(),
    name: v.string(),
    encryptedValue: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_name", ["orgId", "name"]),

  // 52c. AI Provider Configs — per-user provider credentials per org
  aiProviderConfigs: defineTable({
    userId: v.id("users"),
    orgId: v.string(),
    provider: v.union(
      v.literal("anthropic"),
      v.literal("bedrock"),
      v.literal("vertex"),
      v.literal("azure"),
    ),
    encryptedCredentials: v.string(),
    isDefault: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user_org", ["userId", "orgId"])
    .index("by_user_org_provider", ["userId", "orgId", "provider"]),

  // 52d. Sandbox Presets — org-level or personal launch defaults
  sandboxPresets: defineTable({
    orgId: v.string(),
    userId: v.optional(v.id("users")),
    name: v.string(),
    editorType: v.union(v.literal("monaco"), v.literal("codemirror"), v.literal("none")),
    ttlMinutes: v.number(),
    envVarOverrides: v.array(
      v.object({
        name: v.string(),
        value: v.string(),
      }),
    ),
    mcpServerOverrides: v.array(v.string()),
    isDefault: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_user", ["orgId", "userId"]),

  // 52e. Sandbox Queue — queued work when sandbox infra is unavailable
  sandboxQueue: defineTable({
    orgId: v.string(),
    taskId: v.id("tasks"),
    config: v.any(),
    queuedAt: v.number(),
    queuedBy: v.id("users"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_org", ["orgId"])
    .index("by_org_status", ["orgId", "status"])
    .index("by_task", ["taskId"]),

  // 52. Sandbox Sessions — lifecycle for Cloudflare sandbox task execution
  sandboxSessions: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    taskId: v.id("tasks"),
    repositoryId: v.optional(v.id("sourceControlRepositories")),
    runtime: v.optional(v.union(v.literal("cloud"), v.literal("local"))),
    localDeviceId: v.optional(v.string()),
    localDeviceName: v.optional(v.string()),
    sandboxId: v.string(),
    worktreeBranch: v.string(),
    status: v.union(
      v.literal("provisioning"),
      v.literal("cloning"),
      v.literal("executing"),
      v.literal("sleeping"),
      v.literal("ready"),
      v.literal("finalizing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("deleting"),
    ),
    taskPrompt: v.string(),
    skillId: v.optional(v.id("skills")),
    assignedBy: v.id("users"),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    tokensUsed: v.optional(v.number()),
    keepAlive: v.optional(v.boolean()),
    sleepAfter: v.optional(v.string()),
    editorType: v.optional(
      v.union(v.literal("monaco"), v.literal("codemirror"), v.literal("none")),
    ),
    ttlMinutes: v.optional(v.number()),
    authProvider: v.optional(
      v.union(
        v.literal("anthropic"),
        v.literal("bedrock"),
        v.literal("vertex"),
        v.literal("azure"),
      ),
    ),
    model: v.optional(v.string()),
    isPinned: v.optional(v.boolean()),
    pinnedAt: v.optional(v.number()),
    pinnedBy: v.optional(v.id("users")),
    setupProgress: v.optional(setupProgressValidator),
    runtimeMode: v.optional(sandboxRuntimeModeValidator),
    claudeSessionId: v.optional(v.string()),
    presetId: v.optional(v.id("sandboxPresets")),
    // Subtask execution fields
    subtaskId: v.optional(v.id("subtasks")),
    executionMode: v.optional(v.union(v.literal("standard"), v.literal("subtask"))),
    // Legacy field — exists on older documents, no longer written
    workerMode: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_runtime", ["orgId", "runtime"])
    .index("by_status", ["orgId", "status"])
    .index("by_sandboxId", ["sandboxId"])
    .index("by_task_started", ["taskId", "startedAt"])
    .index("by_worktree_branch", ["worktreeBranch"]),

  // 53. Sandbox Logs — append-only execution log stream for sandbox sessions
  sandboxLogs: defineTable({
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    taskId: v.optional(v.id("tasks")),
    subtaskId: v.optional(v.id("subtasks")),
    timestamp: v.number(),
    level: v.union(
      v.literal("info"),
      v.literal("stdout"),
      v.literal("stderr"),
      v.literal("system"),
      v.literal("error"),
    ),
    message: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_session", ["sessionId", "timestamp"])
    .index("by_task", ["taskId", "timestamp"])
    .index("by_subtask", ["subtaskId"])
    .index("by_org", ["orgId"]),

  // 53b. Chat Messages — user<->Claude chat within sandbox sessions
  chatMessages: defineTable({
    orgId: v.string(),
    sessionId: v.id("sandboxSessions"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("error"),
    ),
    error: v.optional(v.string()),
    tokensUsed: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId", "createdAt"])
    .index("by_org", ["orgId"]),

  // 53a. Subtasks — Level 2 task decomposition for sandbox agent execution
  subtasks: defineTable({
    orgId: v.string(),
    taskId: v.id("tasks"),
    programId: v.id("programs"),
    title: v.string(),
    description: v.string(),
    prompt: v.string(),
    estimatedFiles: v.number(),
    complexityScore: v.number(),
    estimatedDurationMs: v.number(),
    allowedFiles: v.optional(v.array(v.string())),
    order: v.number(),
    isPausePoint: v.boolean(),
    status: v.union(
      v.literal("pending"),
      v.literal("executing"),
      v.literal("retrying"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    retryCount: v.number(),
    commitSha: v.optional(v.string()),
    filesChanged: v.optional(v.array(v.string())),
    scopeViolations: v.optional(v.array(v.string())),
    executionDurationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    priorChangelog: v.optional(v.string()),
  })
    .index("by_task", ["taskId", "order"])
    .index("by_program", ["programId"])
    .index("by_org", ["orgId"])
    .index("by_status", ["taskId", "status"]),

  // 54. Execution Audit Records — compliance-ready audit trail for sandbox & agent activity
  executionAuditRecords: defineTable({
    // Tenant & scope
    orgId: v.string(),
    programId: v.id("programs"),

    // Entity links
    taskId: v.id("tasks"),
    sandboxSessionId: v.optional(v.id("sandboxSessions")),
    agentExecutionId: v.optional(v.id("agentExecutions")),

    // Event classification
    eventType: v.union(
      v.literal("sandbox_started"),
      v.literal("sandbox_completed"),
      v.literal("sandbox_failed"),
      v.literal("sandbox_cancelled"),
      v.literal("review_accepted"),
      v.literal("review_rejected"),
      v.literal("review_revised"),
      v.literal("subtask_started"),
      v.literal("subtask_completed"),
      v.literal("subtask_failed"),
      v.literal("subtask_retried"),
    ),

    // Who
    initiatedBy: v.id("users"),
    initiatedByName: v.string(),
    initiatedByClerkId: v.string(),

    // When
    timestamp: v.number(),
    executionStartedAt: v.optional(v.number()),
    executionCompletedAt: v.optional(v.number()),

    // What — point-in-time snapshots
    taskTitle: v.string(),
    taskPrompt: v.optional(v.string()),
    skillId: v.optional(v.id("skills")),
    skillName: v.optional(v.string()),
    workstreamId: v.optional(v.id("workstreams")),

    // Environment metadata
    environment: v.object({
      sandboxId: v.optional(v.string()),
      worktreeBranch: v.optional(v.string()),
      repositoryId: v.optional(v.id("sourceControlRepositories")),
      executionMode: v.optional(v.string()),
    }),

    // Outcome
    outcome: v.object({
      status: v.string(),
      prUrl: v.optional(v.string()),
      prNumber: v.optional(v.number()),
      commitSha: v.optional(v.string()),
      filesChanged: v.optional(v.number()),
      tokensUsed: v.optional(v.number()),
      durationMs: v.optional(v.number()),
      error: v.optional(v.string()),
    }),

    // Compliance — review tracking
    reviewStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("revised"),
        v.literal("rejected"),
      ),
    ),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNotes: v.optional(v.string()),

    // Extensible
    metadata: v.optional(v.any()),
  })
    .index("by_org", ["orgId"])
    .index("by_program", ["programId"])
    .index("by_task", ["taskId"])
    .index("by_session", ["sandboxSessionId"])
    .index("by_event_type", ["orgId", "eventType"])
    .index("by_initiated_by", ["initiatedBy"])
    .index("by_timestamp", ["orgId", "timestamp"])
    .index("by_agent_execution", ["agentExecutionId"]),

  // 55. Notifications — user-scoped in-app notifications
  notifications: defineTable({
    orgId: v.string(),
    userId: v.id("users"),
    programId: v.optional(v.id("programs")),
    type: v.union(
      v.literal("sandbox_complete"),
      v.literal("sandbox_failed"),
      v.literal("pr_ready"),
      v.literal("review_requested"),
      v.literal("subtask_completed"),
      v.literal("subtask_failed"),
      v.literal("subtask_scope_violation"),
      v.literal("all_subtasks_complete"),
      v.literal("subtask_paused"),
      v.literal("verification_completed"),
      v.literal("verification_failed"),
      v.literal("orchestration_plan_ready"),
      v.literal("orchestration_complete"),
      v.literal("orchestration_failed"),
    ),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    entityType: v.optional(v.string()),
    entityId: v.optional(v.string()),
    read: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user_read", ["userId", "read"])
    .index("by_org", ["orgId"]),

  // Source Control Activity Events — timeline events for PRs and tasks
  sourceControlActivityEvents: defineTable({
    orgId: v.string(),
    taskId: v.optional(v.id("tasks")),
    prId: v.optional(v.id("sourceControlPullRequests")),
    eventType: v.union(
      v.literal("pr_created"),
      v.literal("pr_merged"),
      v.literal("pr_closed"),
      v.literal("pr_reopened"),
      v.literal("pr_converted_to_draft"),
      v.literal("pr_ready_for_review"),
      v.literal("commit_pushed"),
      v.literal("review_submitted"),
      v.literal("review_requested"),
      v.literal("ci_status_changed"),
      v.literal("conflict_detected"),
      v.literal("conflict_resolved"),
      v.literal("description_updated"),
    ),
    actorLogin: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
    occurredAt: v.number(),
  })
    .index("by_task", ["taskId", "occurredAt"])
    .index("by_pr", ["prId", "occurredAt"])
    .index("by_org", ["orgId", "occurredAt"]),

  // ---------------------------------------------------------------------------
  // Task Verification Pipeline
  // ---------------------------------------------------------------------------

  taskVerifications: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    taskId: v.id("tasks"),
    sandboxSessionId: v.optional(v.id("sandboxSessions")),
    triggeredBy: v.id("users"),
    trigger: v.union(v.literal("automatic"), v.literal("manual")),
    status: v.union(
      v.literal("pending"),
      v.literal("provisioning"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    navigationPlan: v.optional(
      v.object({
        routes: v.array(
          v.object({
            url: v.string(),
            description: v.string(),
            waitFor: v.optional(v.string()),
            interactions: v.optional(
              v.array(
                v.object({
                  action: v.union(
                    v.literal("click"),
                    v.literal("type"),
                    v.literal("scroll"),
                    v.literal("wait"),
                  ),
                  selector: v.optional(v.string()),
                  value: v.optional(v.string()),
                  description: v.string(),
                }),
              ),
            ),
          }),
        ),
        assertions: v.array(
          v.object({
            description: v.string(),
            type: v.union(v.literal("visual"), v.literal("functional"), v.literal("accessibility")),
            selector: v.optional(v.string()),
            expected: v.optional(v.string()),
          }),
        ),
      }),
    ),
    commitSha: v.optional(v.string()),
    prUrl: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    branch: v.optional(v.string()),
    checksTotal: v.optional(v.number()),
    checksPassed: v.optional(v.number()),
    checksFailed: v.optional(v.number()),
    screenshotCount: v.optional(v.number()),
    aiSummary: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_task", ["taskId"])
    .index("by_task_status", ["taskId", "status"])
    .index("by_org", ["orgId"]),

  verificationScreenshots: defineTable({
    orgId: v.string(),
    verificationId: v.id("taskVerifications"),
    storageId: v.id("_storage"),
    route: v.string(),
    label: v.string(),
    viewport: v.object({
      width: v.number(),
      height: v.number(),
    }),
    capturedAt: v.number(),
    order: v.number(),
  })
    .index("by_verification", ["verificationId", "order"])
    .index("by_org", ["orgId"]),

  verificationChecks: defineTable({
    orgId: v.string(),
    verificationId: v.id("taskVerifications"),
    type: v.union(
      v.literal("visual"),
      v.literal("functional"),
      v.literal("accessibility"),
      v.literal("console_error"),
      v.literal("network_error"),
    ),
    description: v.string(),
    status: v.union(
      v.literal("passed"),
      v.literal("failed"),
      v.literal("warning"),
      v.literal("skipped"),
    ),
    route: v.optional(v.string()),
    selector: v.optional(v.string()),
    expected: v.optional(v.string()),
    actual: v.optional(v.string()),
    screenshotId: v.optional(v.id("verificationScreenshots")),
    aiExplanation: v.optional(v.string()),
    order: v.number(),
  })
    .index("by_verification", ["verificationId", "order"])
    .index("by_verification_status", ["verificationId", "status"])
    .index("by_org", ["orgId"]),
  // =========================================================================
  // Codebase Analysis (Code Analyzer utility)
  // =========================================================================

  // Top-level analysis record — tracks a single repo analysis run
  codebaseAnalyses: defineTable({
    orgId: v.string(),
    programId: v.id("programs"),
    repositoryId: v.optional(v.id("repositories")),
    repoUrl: v.string(),
    repoName: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("scanning"),
      v.literal("analyzing"),
      v.literal("mapping"),
      v.literal("touring"),
      v.literal("reviewing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    currentStage: v.optional(v.string()),
    error: v.optional(v.string()),
    summary: v.optional(
      v.object({
        totalFiles: v.number(),
        totalFunctions: v.number(),
        totalClasses: v.number(),
        languages: v.array(v.string()),
        frameworks: v.array(v.string()),
        layerBreakdown: v.array(v.object({ layer: v.string(), count: v.number() })),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_program", ["orgId", "programId"]),

  // Individual nodes in the knowledge graph (files, functions, classes)
  codebaseGraphNodes: defineTable({
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    nodeType: v.union(
      v.literal("file"),
      v.literal("function"),
      v.literal("class"),
      v.literal("module"),
    ),
    name: v.string(),
    filePath: v.string(),
    layer: v.union(
      v.literal("api"),
      v.literal("service"),
      v.literal("data"),
      v.literal("ui"),
      v.literal("utility"),
      v.literal("config"),
      v.literal("test"),
    ),
    description: v.string(),
    language: v.string(),
    lineStart: v.optional(v.number()),
    lineEnd: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_analysis", ["analysisId"])
    .index("by_analysis_type", ["analysisId", "nodeType"])
    .index("by_analysis_layer", ["analysisId", "layer"]),

  // Relationships between graph nodes
  codebaseGraphEdges: defineTable({
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    sourceNodeId: v.id("codebaseGraphNodes"),
    targetNodeId: v.id("codebaseGraphNodes"),
    edgeType: v.union(
      v.literal("imports"),
      v.literal("calls"),
      v.literal("extends"),
      v.literal("implements"),
      v.literal("contains"),
    ),
  })
    .index("by_analysis", ["analysisId"])
    .index("by_source", ["analysisId", "sourceNodeId"])
    .index("by_target", ["analysisId", "targetNodeId"]),

  // Semantic search embeddings for code entities (AST-extracted)
  codebaseEntityEmbeddings: defineTable({
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    programId: v.id("programs"),
    entityType: v.string(),
    name: v.string(),
    filePath: v.string(),
    lineStart: v.number(),
    lineEnd: v.number(),
    signature: v.string(),
    docstring: v.optional(v.string()),
    bodyPreview: v.optional(v.string()),
    embedding: v.array(v.float64()),
    embeddingModel: v.string(),
  })
    .index("by_analysis", ["analysisId"])
    .index("by_org_program", ["orgId", "programId"])
    .index("by_analysis_type", ["analysisId", "entityType"]),

  // =========================================================================
  // Codebase Requirement Analysis
  // =========================================================================

  // Analysis runs — tracks each analysis execution
  codebaseAnalysisRuns: defineTable({
    programId: v.id("programs"),
    orgId: v.string(),
    workstreamId: v.optional(v.id("workstreams")),
    requirementId: v.optional(v.id("requirements")),
    taskId: v.optional(v.id("tasks")),
    triggeredBy: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    scope: v.union(
      v.literal("requirement"),
      v.literal("workstream"),
      v.literal("program"),
      v.literal("task"),
    ),
    config: v.object({
      branch: v.string(),
      directoryFilter: v.optional(v.string()),
      fileTypeFilter: v.optional(v.array(v.string())),
      confidenceThreshold: v.number(),
      modelTier: v.union(v.literal("fast"), v.literal("standard"), v.literal("thorough")),
      useKnowledgeGraph: v.boolean(),
    }),
    repositoryIds: v.array(v.id("sourceControlRepositories")),
    totalRequirements: v.number(),
    analyzedCount: v.number(),
    summary: v.optional(
      v.object({
        notFound: v.number(),
        partiallyImplemented: v.number(),
        fullyImplemented: v.number(),
        needsVerification: v.number(),
        autoApplied: v.number(),
        pendingReview: v.number(),
      }),
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    tokenUsage: v.optional(
      v.object({
        input: v.number(),
        output: v.number(),
        cost: v.number(),
      }),
    ),
  })
    .index("by_org_program", ["orgId", "programId"])
    .index("by_workstream", ["orgId", "workstreamId"])
    .index("by_status", ["orgId", "status"])
    .index("by_triggered", ["orgId", "triggeredBy"]),

  // Analysis results — per-requirement analysis output
  codebaseAnalysisResults: defineTable({
    runId: v.id("codebaseAnalysisRuns"),
    programId: v.id("programs"),
    orgId: v.string(),
    requirementId: v.id("requirements"),
    taskId: v.optional(v.id("tasks")),
    implementationStatus: v.union(
      v.literal("not_found"),
      v.literal("partially_implemented"),
      v.literal("fully_implemented"),
      v.literal("needs_verification"),
    ),
    confidence: v.number(),
    confidenceReasoning: v.string(),
    evidence: v.object({
      files: v.array(
        v.object({
          repositoryId: v.string(),
          filePath: v.string(),
          lineStart: v.optional(v.number()),
          lineEnd: v.optional(v.number()),
          snippet: v.optional(v.string()),
          relevance: v.string(),
        }),
      ),
    }),
    gapDescription: v.optional(v.string()),
    previousStatus: v.optional(v.string()),
    proposedStatus: v.optional(v.string()),
    proposedPipelineStage: v.optional(v.string()),
    reviewStatus: v.union(
      v.literal("auto_applied"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("regression_flagged"),
    ),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewNote: v.optional(v.string()),
  })
    .index("by_run", ["runId"])
    .index("by_requirement", ["orgId", "requirementId"])
    .index("by_review_status", ["orgId", "reviewStatus"])
    .index("by_org_program", ["orgId", "programId"]),

  // Subtask proposals — AI-suggested changes to task subtasks
  codebaseAnalysisSubtaskProposals: defineTable({
    runId: v.id("codebaseAnalysisRuns"),
    resultId: v.id("codebaseAnalysisResults"),
    orgId: v.string(),
    taskId: v.id("tasks"),
    subtaskId: v.optional(v.id("subtasks")),
    proposalType: v.union(
      v.literal("status_change"),
      v.literal("rewrite"),
      v.literal("new_subtask"),
      v.literal("skip"),
    ),
    currentState: v.optional(
      v.object({
        title: v.string(),
        description: v.string(),
        prompt: v.string(),
        status: v.string(),
      }),
    ),
    proposedState: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      prompt: v.optional(v.string()),
      status: v.optional(v.string()),
    }),
    reasoning: v.string(),
    evidence: v.object({
      files: v.array(
        v.object({
          filePath: v.string(),
          lineStart: v.optional(v.number()),
          lineEnd: v.optional(v.number()),
          snippet: v.optional(v.string()),
        }),
      ),
    }),
    reviewStatus: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    reviewedBy: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_run", ["runId"])
    .index("by_task", ["orgId", "taskId"])
    .index("by_review", ["orgId", "reviewStatus"]),

  // Guided architecture walkthroughs
  codebaseTours: defineTable({
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    title: v.string(),
    description: v.string(),
    steps: v.array(
      v.object({
        nodeId: v.id("codebaseGraphNodes"),
        title: v.string(),
        explanation: v.string(),
        order: v.number(),
      }),
    ),
  }).index("by_analysis", ["analysisId"]),

  // Chat messages for codebase exploration Q&A
  codebaseChatMessages: defineTable({
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    referencedNodes: v.optional(v.array(v.id("codebaseGraphNodes"))),
    createdAt: v.number(),
  })
    .index("by_analysis", ["analysisId"])
    .index("by_analysis_time", ["analysisId", "createdAt"]),

  // Real-time activity logs for codebase analysis progress
  codebaseAnalysisLogs: defineTable({
    orgId: v.string(),
    analysisId: v.id("codebaseAnalyses"),
    step: v.string(),
    message: v.string(),
    detail: v.optional(v.string()),
    level: v.union(v.literal("info"), v.literal("success"), v.literal("error")),
    timestamp: v.number(),
  }).index("by_analysis", ["analysisId", "timestamp"]),

  // =========================================================================
  // Billing & Usage Tracking
  // =========================================================================

  // Append-only AI cost ledger — single source of truth for billing queries
  aiUsageRecords: defineTable({
    orgId: v.string(),
    programId: v.optional(v.id("programs")),
    source: v.union(
      v.literal("document_analysis"),
      v.literal("design_analysis"),
      v.literal("video_analysis"),
      v.literal("skill_execution"),
      v.literal("subtask_generation"),
      v.literal("health_scoring"),
      v.literal("dependency_detection"),
      v.literal("sprint_planning"),
      v.literal("risk_assessment"),
      v.literal("gate_evaluation"),
      v.literal("daily_digest"),
      v.literal("pr_review"),
      v.literal("requirement_refinement"),
      v.literal("task_decomposition"),
      v.literal("sandbox_chat"),
      v.literal("other"),
    ),
    claudeModelId: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.number(),
    cacheCreationTokens: v.number(),
    costUsd: v.number(),
    durationMs: v.optional(v.number()),
    sourceEntityId: v.optional(v.string()),
    sourceEntityTable: v.optional(v.string()),
    recordedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_recorded", ["orgId", "recordedAt"])
    .index("by_org_source", ["orgId", "source"])
    .index("by_program", ["programId"])
    .index("by_program_recorded", ["programId", "recordedAt"])
    .index("by_source_entity", ["sourceEntityId"]),

  // Pricing plan definitions — three branded tiers
  pricingPlans: defineTable({
    slug: v.union(v.literal("crucible"), v.literal("forge"), v.literal("foundry")),
    displayName: v.string(),
    tagline: v.string(),
    monthlyPriceUsd: v.number(),
    annualPriceUsd: v.optional(v.number()),
    stripePriceId: v.string(),
    stripeAnnualPriceId: v.optional(v.string()),
    stripeOveragePriceId: v.string(),
    overageRateUsd: v.number(),
    limits: v.object({
      maxSeats: v.number(),
      maxPrograms: v.number(),
      maxSessionsPerMonth: v.number(),
    }),
    features: v.array(v.string()),
    isPublic: v.boolean(),
    sortOrder: v.number(),
    buyingMotion: v.union(
      v.literal("self_serve"),
      v.literal("sales_assisted"),
      v.literal("annual_contract"),
    ),
  }).index("by_slug", ["slug"]),

  // Subscriptions — core billing state per org
  subscriptions: defineTable({
    orgId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    planSlug: v.union(v.literal("crucible"), v.literal("forge"), v.literal("foundry")),
    status: v.union(
      v.literal("trialing"),
      v.literal("active"),
      v.literal("past_due"),
      v.literal("canceled"),
      v.literal("unpaid"),
      v.literal("incomplete"),
      v.literal("paused"),
    ),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    trialEnd: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_org", ["orgId"])
    .index("by_stripe_customer", ["stripeCustomerId"])
    .index("by_stripe_subscription", ["stripeSubscriptionId"]),

  // Trial state — "The Smelt Experience" per org
  trialState: defineTable({
    orgId: v.string(),
    sessionsUsed: v.number(),
    sessionsLimit: v.number(),
    programsUsed: v.number(),
    programsLimit: v.number(),
    startedAt: v.number(),
    convertedAt: v.optional(v.number()),
    convertedToPlan: v.optional(
      v.union(v.literal("crucible"), v.literal("forge"), v.literal("foundry")),
    ),
  }).index("by_org", ["orgId"]),

  // Billing events — immutable Stripe event log
  billingEvents: defineTable({
    orgId: v.optional(v.string()),
    stripeEventId: v.string(),
    eventType: v.string(),
    status: v.union(v.literal("pending"), v.literal("processed"), v.literal("failed")),
    payload: v.any(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    receivedAt: v.number(),
  })
    .index("by_stripe_event", ["stripeEventId"])
    .index("by_status", ["status"]),

  // Usage periods — monthly aggregate per org
  usagePeriods: defineTable({
    orgId: v.string(),
    periodStart: v.number(),
    periodEnd: v.number(),
    sandboxSessionCount: v.number(),
    documentAnalysisCount: v.number(),
    videoAnalysisCount: v.number(),
    totalAiCostUsd: v.number(),
    totalInputTokens: v.number(),
    totalOutputTokens: v.number(),
    totalCacheReadTokens: v.number(),
    totalCacheCreationTokens: v.number(),
    overageSessionCount: v.number(),
    overageReportedToStripe: v.boolean(),
    lastUpdatedAt: v.number(),
  }).index("by_org_period", ["orgId", "periodStart"]),

  // ── Service Resilience ─────────────────────────────────────────────

  // Service health checks — point-in-time health snapshots per service
  serviceHealthChecks: defineTable({
    orgId: v.string(),
    service: v.string(),
    status: v.union(
      v.literal("healthy"),
      v.literal("degraded"),
      v.literal("outage"),
      v.literal("unknown"),
    ),
    latencyMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    checkedAt: v.number(),
    checkType: v.union(v.literal("cron"), v.literal("probe"), v.literal("inferred")),
  })
    .index("by_service_checked", ["service", "checkedAt"])
    .index("by_org_service", ["orgId", "service"])
    .index("by_checked", ["checkedAt"]),

  // Service incidents — outage/degradation tracking with timeline
  serviceIncidents: defineTable({
    orgId: v.string(),
    service: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("investigating"),
      v.literal("identified"),
      v.literal("monitoring"),
      v.literal("resolved"),
    ),
    severity: v.union(v.literal("minor"), v.literal("major"), v.literal("critical")),
    affectedComponents: v.array(v.string()),
    timeline: v.array(
      v.object({
        timestamp: v.number(),
        status: v.string(),
        message: v.string(),
        updatedBy: v.optional(v.string()),
      }),
    ),
    startedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    autoCreated: v.boolean(),
  })
    .index("by_org_status", ["orgId", "status"])
    .index("by_org_service", ["orgId", "service"])
    .index("by_org_started", ["orgId", "startedAt"]),

  // AI operation checkpoints — resumable long-running AI operations
  aiOperationCheckpoints: defineTable({
    orgId: v.string(),
    operationId: v.string(),
    operationType: v.string(),
    entityId: v.string(),
    entityTable: v.string(),
    stage: v.string(),
    progress: v.number(),
    intermediateData: v.optional(v.any()),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("abandoned"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_org_operation", ["orgId", "operationId"])
    .index("by_entity", ["entityTable", "entityId"])
    .index("by_status", ["status"])
    .index("by_expires", ["expiresAt"]),

  // Google Drive Credentials — OAuth tokens for Google Drive integration
  googleDriveCredentials: defineTable({
    orgId: v.string(),
    userId: v.id("users"),
    // AES-256-GCM encrypted tokens (same pattern as atlassianConnections)
    accessTokenEncrypted: v.optional(v.string()),
    refreshTokenEncrypted: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    scopes: v.optional(v.array(v.string())),
    // Google account info
    googleEmail: v.optional(v.string()),
    googleUserId: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("expired"), v.literal("revoked")),
    // OAuth state for CSRF protection during flow
    oauthState: v.optional(v.string()),
    connectedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"])
    .index("by_oauth_state", ["oauthState"]),

  // Agent Team
  agentTemplates,
  programAgents,
  agentVersions,
  agentTaskExecutions,
  sprintWorkflows,
  agentNotifications,
  orgAgentSettings,

  // Orchestration
  orchestrationRuns,
  orchestrationEvents,
});
