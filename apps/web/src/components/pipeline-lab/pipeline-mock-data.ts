import type {
  MockRequirement,
  MockWorkstream,
  PipelineStage,
  PipelineStageConfig,
} from "./pipeline-types";

// Stage configuration in pipeline order
export const PIPELINE_STAGES: PipelineStageConfig[] = [
  { id: "discovery", label: "Discovery", shortLabel: "DISC", order: 0 },
  { id: "gap_analysis", label: "Gap Analysis", shortLabel: "GAP", order: 1 },
  { id: "solution_design", label: "Solution Design", shortLabel: "SOL", order: 2 },
  { id: "sprint_planning", label: "Sprint Planning", shortLabel: "PLAN", order: 3 },
  { id: "implementation", label: "Implementation", shortLabel: "IMPL", order: 4 },
  { id: "testing", label: "Testing", shortLabel: "TEST", order: 5 },
  { id: "uat", label: "UAT", shortLabel: "UAT", order: 6 },
  { id: "deployed", label: "Deployed", shortLabel: "LIVE", order: 7 },
];

// Workstreams for AcmeCorp migration
export const MOCK_WORKSTREAMS: MockWorkstream[] = [
  {
    id: "ws-catalog",
    name: "Catalog & Products",
    shortCode: "CAT",
    color: "#3b82f6",
    requirements: [
      "req-cat-001",
      "req-cat-002",
      "req-cat-003",
      "req-cat-004",
      "req-cat-005",
      "req-cat-006",
    ],
  },
  {
    id: "ws-checkout",
    name: "Checkout & Payments",
    shortCode: "CHK",
    color: "#10b981",
    requirements: [
      "req-chk-001",
      "req-chk-002",
      "req-chk-003",
      "req-chk-004",
      "req-chk-005",
      "req-chk-006",
    ],
  },
  {
    id: "ws-orders",
    name: "Order Management",
    shortCode: "ORD",
    color: "#f59e0b",
    requirements: [
      "req-ord-001",
      "req-ord-002",
      "req-ord-003",
      "req-ord-004",
      "req-ord-005",
      "req-ord-006",
    ],
  },
];

// 18 requirements distributed across stages
export const MOCK_REQUIREMENTS: MockRequirement[] = [
  // --- Discovery (2 items) ---
  {
    id: "req-cat-001",
    refId: "CAT-001",
    title: "Product attribute mapping from Magento to B2B Commerce",
    workstreamId: "ws-catalog",
    currentStage: "discovery",
    health: "on_track",
    priority: "must_have",
    fitGap: "config",
    effort: "medium",
    daysInStage: 3,
    stageHistory: [{ stage: "discovery", enteredAt: "2026-02-12" }],
  },
  {
    id: "req-ord-001",
    refId: "ORD-001",
    title: "Order status lifecycle mapping",
    workstreamId: "ws-orders",
    currentStage: "discovery",
    health: "on_track",
    priority: "should_have",
    fitGap: "native",
    effort: "low",
    daysInStage: 2,
    stageHistory: [{ stage: "discovery", enteredAt: "2026-02-13" }],
  },

  // --- Gap Analysis (2 items) ---
  {
    id: "req-chk-001",
    refId: "CHK-001",
    title: "Multi-step checkout with saved payment methods",
    workstreamId: "ws-checkout",
    currentStage: "gap_analysis",
    health: "at_risk",
    priority: "must_have",
    fitGap: "custom_dev",
    effort: "high",
    daysInStage: 5,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-02-05", exitedAt: "2026-02-10" },
      { stage: "gap_analysis", enteredAt: "2026-02-10" },
    ],
    aiRecommendation:
      "Consider Stripe Elements integration for saved payment method support instead of custom development.",
  },
  {
    id: "req-cat-002",
    refId: "CAT-002",
    title: "Category hierarchy migration with SEO URL preservation",
    workstreamId: "ws-catalog",
    currentStage: "gap_analysis",
    health: "on_track",
    priority: "must_have",
    fitGap: "config",
    effort: "medium",
    daysInStage: 3,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-02-04", exitedAt: "2026-02-09" },
      { stage: "gap_analysis", enteredAt: "2026-02-09" },
    ],
  },

  // --- Solution Design (2 items) ---
  {
    id: "req-ord-002",
    refId: "ORD-002",
    title: "Bulk order import from legacy ERP system",
    workstreamId: "ws-orders",
    currentStage: "solution_design",
    health: "on_track",
    priority: "should_have",
    fitGap: "third_party",
    effort: "high",
    daysInStage: 4,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-28", exitedAt: "2026-02-02" },
      { stage: "gap_analysis", enteredAt: "2026-02-02", exitedAt: "2026-02-08" },
      { stage: "solution_design", enteredAt: "2026-02-08" },
    ],
  },
  {
    id: "req-chk-002",
    refId: "CHK-002",
    title: "B2B purchase order payment method",
    workstreamId: "ws-checkout",
    currentStage: "solution_design",
    health: "on_track",
    priority: "must_have",
    fitGap: "native",
    effort: "low",
    daysInStage: 2,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-30", exitedAt: "2026-02-03" },
      { stage: "gap_analysis", enteredAt: "2026-02-03", exitedAt: "2026-02-10" },
      { stage: "solution_design", enteredAt: "2026-02-10" },
    ],
  },

  // --- Sprint Planning (4 items - bottleneck) ---
  {
    id: "req-cat-003",
    refId: "CAT-003",
    title: "Product image batch migration with CDN routing",
    workstreamId: "ws-catalog",
    currentStage: "sprint_planning",
    health: "at_risk",
    priority: "must_have",
    fitGap: "custom_dev",
    effort: "very_high",
    daysInStage: 6,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-20", exitedAt: "2026-01-25" },
      { stage: "gap_analysis", enteredAt: "2026-01-25", exitedAt: "2026-01-30" },
      { stage: "solution_design", enteredAt: "2026-01-30", exitedAt: "2026-02-06" },
      { stage: "sprint_planning", enteredAt: "2026-02-06" },
    ],
    aiRecommendation:
      "High effort item stuck in planning. Consider breaking into 3 sub-tasks: CDN setup, batch script, URL redirect rules.",
  },
  {
    id: "req-chk-003",
    refId: "CHK-003",
    title: "Tax calculation engine integration",
    workstreamId: "ws-checkout",
    currentStage: "sprint_planning",
    health: "on_track",
    priority: "must_have",
    fitGap: "third_party",
    effort: "medium",
    daysInStage: 3,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-22", exitedAt: "2026-01-27" },
      { stage: "gap_analysis", enteredAt: "2026-01-27", exitedAt: "2026-02-01" },
      { stage: "solution_design", enteredAt: "2026-02-01", exitedAt: "2026-02-09" },
      { stage: "sprint_planning", enteredAt: "2026-02-09" },
    ],
  },
  {
    id: "req-ord-003",
    refId: "ORD-003",
    title: "Return & refund workflow with approval chain",
    workstreamId: "ws-orders",
    currentStage: "sprint_planning",
    health: "at_risk",
    priority: "should_have",
    fitGap: "custom_dev",
    effort: "high",
    daysInStage: 7,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-18", exitedAt: "2026-01-22" },
      { stage: "gap_analysis", enteredAt: "2026-01-22", exitedAt: "2026-01-28" },
      { stage: "solution_design", enteredAt: "2026-01-28", exitedAt: "2026-02-05" },
      { stage: "sprint_planning", enteredAt: "2026-02-05" },
    ],
    aiRecommendation:
      "Approval chain complexity is causing delays. Suggest MVP with single-level approval, then iterate.",
  },
  {
    id: "req-cat-004",
    refId: "CAT-004",
    title: "Custom pricing rules for B2B customer tiers",
    workstreamId: "ws-catalog",
    currentStage: "sprint_planning",
    health: "on_track",
    priority: "must_have",
    fitGap: "config",
    effort: "medium",
    daysInStage: 2,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-20", exitedAt: "2026-01-24" },
      { stage: "gap_analysis", enteredAt: "2026-01-24", exitedAt: "2026-01-30" },
      { stage: "solution_design", enteredAt: "2026-01-30", exitedAt: "2026-02-10" },
      { stage: "sprint_planning", enteredAt: "2026-02-10" },
    ],
  },

  // --- Implementation (3 items, 1 blocked) ---
  {
    id: "req-chk-004",
    refId: "CHK-004",
    title: "Shipping rate calculator with real-time carrier APIs",
    workstreamId: "ws-checkout",
    currentStage: "implementation",
    health: "on_track",
    priority: "must_have",
    fitGap: "third_party",
    effort: "medium",
    daysInStage: 4,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-15", exitedAt: "2026-01-18" },
      { stage: "gap_analysis", enteredAt: "2026-01-18", exitedAt: "2026-01-23" },
      { stage: "solution_design", enteredAt: "2026-01-23", exitedAt: "2026-01-28" },
      { stage: "sprint_planning", enteredAt: "2026-01-28", exitedAt: "2026-02-03" },
      { stage: "implementation", enteredAt: "2026-02-03" },
    ],
  },
  {
    id: "req-cat-005",
    refId: "CAT-005",
    title: "Product search with faceted filtering",
    workstreamId: "ws-catalog",
    currentStage: "implementation",
    health: "blocked",
    priority: "must_have",
    fitGap: "custom_dev",
    effort: "high",
    daysInStage: 8,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-10", exitedAt: "2026-01-14" },
      { stage: "gap_analysis", enteredAt: "2026-01-14", exitedAt: "2026-01-20" },
      { stage: "solution_design", enteredAt: "2026-01-20", exitedAt: "2026-01-25" },
      { stage: "sprint_planning", enteredAt: "2026-01-25", exitedAt: "2026-01-30" },
      { stage: "implementation", enteredAt: "2026-01-30" },
    ],
    aiRecommendation:
      "Blocked on search index provisioning. Escalate to platform team for Algolia credentials.",
  },
  {
    id: "req-ord-004",
    refId: "ORD-004",
    title: "Order notification email templates",
    workstreamId: "ws-orders",
    currentStage: "implementation",
    health: "on_track",
    priority: "should_have",
    fitGap: "config",
    effort: "low",
    daysInStage: 2,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-12", exitedAt: "2026-01-15" },
      { stage: "gap_analysis", enteredAt: "2026-01-15", exitedAt: "2026-01-20" },
      { stage: "solution_design", enteredAt: "2026-01-20", exitedAt: "2026-01-24" },
      { stage: "sprint_planning", enteredAt: "2026-01-24", exitedAt: "2026-02-05" },
      { stage: "implementation", enteredAt: "2026-02-05" },
    ],
  },

  // --- Testing (1 item) ---
  {
    id: "req-chk-005",
    refId: "CHK-005",
    title: "Guest checkout flow with address validation",
    workstreamId: "ws-checkout",
    currentStage: "testing",
    health: "on_track",
    priority: "nice_to_have",
    fitGap: "native",
    effort: "low",
    daysInStage: 3,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-08", exitedAt: "2026-01-11" },
      { stage: "gap_analysis", enteredAt: "2026-01-11", exitedAt: "2026-01-16" },
      { stage: "solution_design", enteredAt: "2026-01-16", exitedAt: "2026-01-20" },
      { stage: "sprint_planning", enteredAt: "2026-01-20", exitedAt: "2026-01-24" },
      { stage: "implementation", enteredAt: "2026-01-24", exitedAt: "2026-02-04" },
      { stage: "testing", enteredAt: "2026-02-04" },
    ],
  },

  // --- UAT (1 item) ---
  {
    id: "req-ord-005",
    refId: "ORD-005",
    title: "Order history dashboard with export",
    workstreamId: "ws-orders",
    currentStage: "uat",
    health: "on_track",
    priority: "should_have",
    fitGap: "config",
    effort: "medium",
    daysInStage: 2,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-05", exitedAt: "2026-01-08" },
      { stage: "gap_analysis", enteredAt: "2026-01-08", exitedAt: "2026-01-13" },
      { stage: "solution_design", enteredAt: "2026-01-13", exitedAt: "2026-01-17" },
      { stage: "sprint_planning", enteredAt: "2026-01-17", exitedAt: "2026-01-22" },
      { stage: "implementation", enteredAt: "2026-01-22", exitedAt: "2026-02-01" },
      { stage: "testing", enteredAt: "2026-02-01", exitedAt: "2026-02-06" },
      { stage: "uat", enteredAt: "2026-02-06" },
    ],
  },

  // --- Deployed (2 items) ---
  {
    id: "req-cat-006",
    refId: "CAT-006",
    title: "Basic product listing page with pagination",
    workstreamId: "ws-catalog",
    currentStage: "deployed",
    health: "on_track",
    priority: "must_have",
    fitGap: "native",
    effort: "low",
    daysInStage: 5,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-02", exitedAt: "2026-01-05" },
      { stage: "gap_analysis", enteredAt: "2026-01-05", exitedAt: "2026-01-09" },
      { stage: "solution_design", enteredAt: "2026-01-09", exitedAt: "2026-01-13" },
      { stage: "sprint_planning", enteredAt: "2026-01-13", exitedAt: "2026-01-16" },
      { stage: "implementation", enteredAt: "2026-01-16", exitedAt: "2026-01-27" },
      { stage: "testing", enteredAt: "2026-01-27", exitedAt: "2026-01-31" },
      { stage: "uat", enteredAt: "2026-01-31", exitedAt: "2026-02-03" },
      { stage: "deployed", enteredAt: "2026-02-03" },
    ],
  },
  {
    id: "req-chk-006",
    refId: "CHK-006",
    title: "Shopping cart with quantity updates and line item removal",
    workstreamId: "ws-checkout",
    currentStage: "deployed",
    health: "on_track",
    priority: "must_have",
    fitGap: "native",
    effort: "low",
    daysInStage: 3,
    stageHistory: [
      { stage: "discovery", enteredAt: "2026-01-03", exitedAt: "2026-01-06" },
      { stage: "gap_analysis", enteredAt: "2026-01-06", exitedAt: "2026-01-10" },
      { stage: "solution_design", enteredAt: "2026-01-10", exitedAt: "2026-01-14" },
      { stage: "sprint_planning", enteredAt: "2026-01-14", exitedAt: "2026-01-17" },
      { stage: "implementation", enteredAt: "2026-01-17", exitedAt: "2026-01-28" },
      { stage: "testing", enteredAt: "2026-01-28", exitedAt: "2026-02-02" },
      { stage: "uat", enteredAt: "2026-02-02", exitedAt: "2026-02-05" },
      { stage: "deployed", enteredAt: "2026-02-05" },
    ],
  },
];

// Helper functions
export function getRequirementsByStage(stage: PipelineStage): MockRequirement[] {
  return MOCK_REQUIREMENTS.filter((r) => r.currentStage === stage);
}

export function getRequirementsByWorkstream(workstreamId: string): MockRequirement[] {
  return MOCK_REQUIREMENTS.filter((r) => r.workstreamId === workstreamId);
}

export function getStageCount(stage: PipelineStage): number {
  return MOCK_REQUIREMENTS.filter((r) => r.currentStage === stage).length;
}
