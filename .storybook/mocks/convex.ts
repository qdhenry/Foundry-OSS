/**
 * Mock for convex/react used in Storybook.
 *
 * Components call useQuery(api.something.get, { id }) — we intercept these
 * and return mock data. Story authors can override data per-story via
 * the `parameters.convexMockData` parameter.
 *
 * The mock data map keys match the query function path format that Convex
 * uses internally (e.g., "programs:get", "workstreams:listByProgram").
 */
import { fn } from "@storybook/test";
import { getFunctionName } from "convex/server";

// ─── Default AcmeCorp mock data ─────────────────────────────────

const MOCK_PROGRAM = {
  _id: "prog-acme-demo" as any,
  _creationTime: Date.now() - 30 * 86400000,
  orgId: "org_foundry_demo",
  name: "AcmeCorp Migration",
  clientName: "AcmeCorp",
  sourcePlatform: "magento" as const,
  targetPlatform: "salesforce_b2b" as const,
  phase: "build" as const,
  status: "active" as const,
  description: "Migration from Magento to Salesforce B2B Commerce",
  stats: {
    totalRequirements: 118,
    completedRequirements: 42,
    completionPercent: 36,
    workstreamCount: 7,
    riskCount: 5,
    agentExecutionCount: 12,
  },
};

const MOCK_WORKSTREAMS = [
  { _id: "ws-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Product Data Migration", shortCode: "PDM", status: "on_track", priority: "high", currentSprint: 2, requirementCount: 24, completedCount: 12, description: "Migrate product catalog" },
  { _id: "ws-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Order History Transfer", shortCode: "OHT", status: "at_risk", priority: "high", currentSprint: 1, requirementCount: 18, completedCount: 4, description: "Transfer order history" },
  { _id: "ws-3" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Customer Accounts", shortCode: "CA", status: "on_track", priority: "medium", currentSprint: 3, requirementCount: 15, completedCount: 8, description: "Migrate customer accounts" },
];

const MOCK_REQUIREMENTS = [
  { _id: "req-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, workstreamId: "ws-1" as any, title: "Product SKU Mapping", description: "Map Magento SKUs to Salesforce format", priority: "must_have", status: "in_progress", complexity: "medium" },
  { _id: "req-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, workstreamId: "ws-1" as any, title: "Category Hierarchy", description: "Rebuild category tree in Salesforce", priority: "must_have", status: "complete", complexity: "high" },
  { _id: "req-3" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, workstreamId: "ws-2" as any, title: "Order Data Validation", description: "Validate historical order data integrity", priority: "should_have", status: "open", complexity: "low" },
];

const MOCK_RISKS = [
  { _id: "risk-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, title: "Data Loss During Migration", severity: "critical", probability: "possible", status: "open", description: "Risk of data loss during product migration", impact: "Customer orders may be lost", mitigation: "Implement incremental validation" },
  { _id: "risk-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, title: "API Rate Limiting", severity: "high", probability: "likely", status: "mitigated", description: "Salesforce API rate limits may slow migration", impact: "Migration timeline extends", mitigation: "Batch API calls with backoff" },
];

const MOCK_SKILLS = [
  { _id: "skill-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Product Data Transform", slug: "product-data-transform", description: "Transform Magento product data to Salesforce format", status: "active", version: 2 },
  { _id: "skill-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Order History ETL", slug: "order-history-etl", description: "Extract, transform, load order history", status: "draft", version: 1 },
];

const MOCK_TASKS = [
  { _id: "task-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, title: "Implement SKU mapping logic", status: "in_progress", priority: "high", assignee: "Sarah Chen", requirementId: "req-1" as any },
  { _id: "task-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, title: "Write category import script", status: "complete", priority: "high", assignee: "Alex Kim", requirementId: "req-2" as any },
  { _id: "task-3" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, title: "Set up order validation pipeline", status: "open", priority: "medium", assignee: null, requirementId: "req-3" as any },
];

const MOCK_SPRINTS = [
  { _id: "sprint-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, workstreamId: "ws-1" as any, name: "Sprint 1 - Foundation", number: 1, status: "completed", startDate: Date.now() - 28 * 86400000, endDate: Date.now() - 14 * 86400000, goal: "Set up product data migration pipeline and initial mappings" },
  { _id: "sprint-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, workstreamId: "ws-1" as any, name: "Sprint 2 - Core Migration", number: 2, status: "active", startDate: Date.now() - 14 * 86400000, endDate: Date.now() + 1 * 86400000, goal: "Complete product catalog migration and validation" },
  { _id: "sprint-3" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, workstreamId: "ws-2" as any, name: "Sprint 1 - Order History", number: 1, status: "planning", startDate: Date.now() + 2 * 86400000, endDate: Date.now() + 16 * 86400000, goal: "Begin order history extraction and transformation" },
];

const MOCK_PLAYBOOKS = [
  { _id: "pb-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Standard B2B Commerce Migration", description: "Step-by-step playbook for migrating from Magento to Salesforce B2B Commerce", targetPlatform: "salesforce_b2b", status: "published", resolvedSteps: [{ title: "Data Audit", description: "Audit source data quality and completeness", workstreamName: "Product Data Migration", workstreamShortCode: "PDM", estimatedHours: 8 }, { title: "Schema Mapping", description: "Map source schema to target schema", workstreamName: "Product Data Migration", workstreamShortCode: "PDM", estimatedHours: 16 }, { title: "ETL Pipeline Setup", description: "Build extraction, transformation, and loading pipeline", workstreamName: "Product Data Migration", workstreamShortCode: "PDM", estimatedHours: 24 }] },
  { _id: "pb-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Customer Data Migration", description: "Playbook for customer account and address migration", targetPlatform: "salesforce_b2b", status: "draft", resolvedSteps: [{ title: "Customer Export", description: "Export customer records from Magento", workstreamName: "Customer Accounts", workstreamShortCode: "CA", estimatedHours: 4 }] },
  { _id: "pb-3" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Legacy Cleanup", description: "Post-migration cleanup procedures", targetPlatform: "platform_agnostic", status: "archived", resolvedSteps: [] },
];

const MOCK_INTEGRATIONS = [
  { _id: "int-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Order Sync API", type: "api", sourceSystem: "Magento 2", targetSystem: "Salesforce B2B Commerce", status: "live", description: "Real-time order synchronization between platforms", notes: "Rate limited to 100 req/min", linkedRequirementIds: ["req-1" as any], resolvedRequirements: [{ _id: "req-1" as any, refId: "PDM-001", title: "Product SKU Mapping" }] },
  { _id: "int-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Inventory Webhook", type: "webhook", sourceSystem: "Warehouse Management", targetSystem: "Salesforce B2B Commerce", status: "testing", description: "Webhook-based inventory updates", notes: null, linkedRequirementIds: [], resolvedRequirements: [] },
  { _id: "int-3" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, name: "Customer Data Feed", type: "file_transfer", sourceSystem: "Magento 2", targetSystem: "Salesforce B2B Commerce", status: "planned", description: "Nightly batch file transfer of customer data", notes: "SFTP-based transfer", linkedRequirementIds: [], resolvedRequirements: [] },
];

const MOCK_TEAM_MEMBERS = [
  { _id: "tm-1" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, userId: "user-1" as any, role: "architect", workstreamIds: ["ws-1" as any], user: { name: "Sarah Chen", email: "sarah@acme.com", avatarUrl: null } },
  { _id: "tm-2" as any, _creationTime: Date.now(), orgId: "org_foundry_demo", programId: "prog-acme-demo" as any, userId: "user-2" as any, role: "developer", workstreamIds: ["ws-1" as any, "ws-2" as any], user: { name: "Alex Kim", email: "alex@acme.com", avatarUrl: null } },
];

const MOCK_INSTALLATIONS = [
  { _id: "inst-1" as any, installationId: 12345, accountLogin: "acme-corp", accountType: "organization", status: "active" },
];

const MOCK_REPOSITORIES = [
  { _id: "repo-1" as any, _creationTime: Date.now(), programId: "prog-acme-demo" as any, repoFullName: "acme-corp/sf-b2b-storefront", role: "storefront", isMonorepo: false, syncStatus: "healthy", defaultBranch: "main", lastWebhookAt: Date.now() - 3600000, pathFilters: [] },
];

const DEFAULT_MOCK_DATA: Record<string, unknown> = {
  // Programs
  "programs:get": MOCK_PROGRAM,
  "programs:list": [MOCK_PROGRAM],

  // Workstreams
  "workstreams:listByProgram": MOCK_WORKSTREAMS,
  "workstreams:get": MOCK_WORKSTREAMS[0],

  // Requirements
  "requirements:listByProgram": MOCK_REQUIREMENTS,
  "requirements:listByWorkstream": MOCK_REQUIREMENTS,
  "requirements:get": MOCK_REQUIREMENTS[0],
  "requirements:countByStatus": { open: 42, in_progress: 34, complete: 42, blocked: 0, total: 118, byStatus: { draft: 12, approved: 30, in_progress: 34, complete: 42 } },
  "requirements:countByPriority": { must_have: 48, should_have: 38, nice_to_have: 22, deferred: 10 },
  "requirements:recentlyImported": { items: [] },

  // Risks
  "risks:listByProgram": MOCK_RISKS,
  "risks:get": MOCK_RISKS[0],

  // Skills
  "skills:listByProgram": MOCK_SKILLS,
  "skills:get": MOCK_SKILLS[0],

  // Tasks
  "tasks:listByProgram": MOCK_TASKS,
  "tasks:get": MOCK_TASKS[0],

  // Discovery
  "discoveryFindings:listByProgram": [],
  "discoveryFindings:countPending": { count: 3 },

  // Audit
  "auditLog:listByProgram": [],

  // AI
  "agentExecutions:listByProgram": [],
  "aiHealthScores:getLatest": { score: 85, trend: "improving" },

  // Sprint Gates
  "sprintGates:listByProgram": [],

  // Users
  "users:getCurrent": { _id: "user-1" as any, name: "Demo User", email: "demo@foundry.io", clerkId: "user_storybook" },
  "users:listByOrg": [{ _id: "user-1" as any, name: "Demo User", email: "demo@foundry.io" }],

  // Sprints
  "sprints:listByProgram": MOCK_SPRINTS,
  "sprints:get": MOCK_SPRINTS[1],

  // Playbooks
  "playbooks:listByProgram": MOCK_PLAYBOOKS,
  "playbooks:get": MOCK_PLAYBOOKS[0],
  "playbooks:listInstances": [],

  // Integrations
  "integrations:listByProgram": MOCK_INTEGRATIONS,
  "integrations:get": MOCK_INTEGRATIONS[0],

  // Team Members
  "teamMembers:listByProgram": MOCK_TEAM_MEMBERS,

  // Documents
  "documents:listByProgram": [],
  "documentAnalyses:listByProgram": [],

  // Sandbox Logs
  "sandbox/logs:listByTask": [],
  "sandbox/logs:summaryByTask": null,

  // Source Control
  "sourceControl/installations:listByOrg": MOCK_INSTALLATIONS,
  "sourceControl/installations:listUnbound": [],
  "sourceControl/repositories:listByProgram": MOCK_REPOSITORIES,
  "sourceControl/activityEvents:listByTask": [],
  "sourceControl/activityEvents:listByProgram": [],
  "sourceControl/health/codeHealthSignals:getForProgram": null,
  "sourceControl/completeness/readinessMatrix:getForProgram": null,
  "sourceControl/branching/strategyRecommendation:getStrategyForSprint": null,
  "sourceControl/patterns/snippetStorage:listSnippets": [],
  "sourceControl/deployments/deploymentTracking:listByProgram": [],
  "sourceControl/gates/codeEvidence:assembleCodeEvidence": null,
  "pullRequests:listByProgram": [],

  // Notifications
  "notifications:listUnread": [],
  "notifications:countUnread": 0,

  // Default fallback
  __default_list: [],
  __default_single: null,
};

// Export mock data for stories to override
export { MOCK_PROGRAM, MOCK_WORKSTREAMS, MOCK_REQUIREMENTS, MOCK_RISKS, MOCK_SKILLS, MOCK_TASKS, MOCK_SPRINTS, MOCK_PLAYBOOKS, MOCK_INTEGRATIONS, MOCK_TEAM_MEMBERS, MOCK_INSTALLATIONS, MOCK_REPOSITORIES, DEFAULT_MOCK_DATA };

// ─── Hook mocks ───────────────────────────────────────────────────────────

/** Extract a lookup key from a Convex query/mutation function reference */
function getQueryKey(queryRef: unknown): string {
  if (queryRef === "skip" || queryRef === undefined) return "__skip__";
  try {
    // getFunctionName extracts the "module:functionName" path from the Proxy
    // e.g. api.programs.get → "programs:get"
    // e.g. api.sourceControl.installations.listByOrg → "sourceControl/installations:listByOrg"
    return getFunctionName(queryRef as any);
  } catch {
    // Fallback for plain strings or other non-Proxy references
    return String(queryRef);
  }
}

// Global mock data store — stories override via parameters
let _currentMockData = { ...DEFAULT_MOCK_DATA };
let _storyMockOverrides: Record<string, unknown> = {};

export function setMockOverrides(overrides: Record<string, unknown>) {
  _storyMockOverrides = overrides;
}

export function clearMockOverrides() {
  _storyMockOverrides = {};
}

export function useQuery(queryRef: unknown, args?: unknown) {
  if (args === "skip" || queryRef === undefined) return undefined;

  const key = getQueryKey(queryRef);
  if (key === "__skip__") return undefined;

  // Check story overrides first, then defaults
  if (key in _storyMockOverrides) return _storyMockOverrides[key];
  if (key in _currentMockData) return _currentMockData[key];

  // Fallback: if it looks like a list query, return empty array
  if (key.includes("list") || key.includes("List")) return [];
  return null;
}

export function useMutation(_mutationRef: unknown) {
  return fn().mockName("convex.mutation");
}

export function useAction(_actionRef: unknown) {
  return fn().mockName("convex.action");
}

export function useConvex() {
  return {
    query: fn().mockName("convex.client.query").mockResolvedValue(null),
    mutation: fn().mockName("convex.client.mutation").mockResolvedValue(null),
    action: fn().mockName("convex.client.action").mockResolvedValue(null),
  };
}

export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: true };
}

export function usePaginatedQuery() {
  return { results: [], status: "Exhausted" as const, loadMore: fn(), isLoading: false };
}

// Re-export ConvexProvider as passthrough
export function ConvexProvider({ children }: { children: React.ReactNode }) {
  return children;
}
