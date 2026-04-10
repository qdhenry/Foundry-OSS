import { describe, expect, it } from "vitest";
import { z } from "zod";

// Replicate the Zod schemas from agent-service route handlers for validation testing

const DiscoveryFindingsSchema = z.object({
  suggested_requirements: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      category: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      rationale: z.string(),
    }),
  ),
  identified_gaps: z.array(
    z.object({
      area: z.string(),
      description: z.string(),
      severity: z.enum(["critical", "high", "medium", "low"]),
      suggested_action: z.string(),
    }),
  ),
  risk_indicators: z.array(
    z.object({
      indicator: z.string(),
      risk_level: z.enum(["critical", "high", "medium", "low"]),
      affected_workstreams: z.array(z.string()),
      mitigation_suggestion: z.string(),
    }),
  ),
  key_insights: z.array(
    z.object({
      insight: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
      source_context: z.string(),
    }),
  ),
});

const RefinementSchema = z.object({
  overall_assessment: z.object({
    clarity_score: z.number().min(1).max(10),
    completeness_score: z.number().min(1).max(10),
    testability_score: z.number().min(1).max(10),
    summary: z.string(),
  }),
  suggestions: z.array(
    z.object({
      area: z.string(),
      current_text: z.string(),
      suggested_text: z.string(),
      reason: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
    }),
  ),
  potential_split: z
    .object({
      should_split: z.boolean(),
      reason: z.string(),
      proposed_sub_requirements: z.array(
        z.object({
          title: z.string(),
          description: z.string(),
        }),
      ),
    })
    .optional(),
  related_requirements: z
    .array(
      z.object({
        requirement_id: z.string(),
        relationship: z.enum(["depends_on", "conflicts_with", "extends", "duplicates"]),
        description: z.string(),
      }),
    )
    .optional(),
});

const TaskDecompositionSchema = z.object({
  decomposition_rationale: z.string(),
  critical_considerations: z.array(z.string()),
  tasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      acceptance_criteria: z.array(z.string()),
      story_points: z.number(),
      dependencies: z.array(z.string()),
      required_skills: z.array(z.string()),
      risk_factors: z.array(z.string()),
      suggested_assignee_role: z.string().optional(),
    }),
  ),
  estimated_total_points: z.number(),
  estimated_sprint_count: z.number().optional(),
});

const SprintCompositionSchema = z.object({
  capacity_analysis: z.object({
    total_capacity_points: z.number(),
    available_team_members: z.number(),
    risk_buffer_percent: z.number(),
    effective_capacity: z.number(),
  }),
  recommended_tasks: z.array(
    z.object({
      task_id: z.string(),
      title: z.string(),
      story_points: z.number(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      assigned_to: z.string().optional(),
      rationale: z.string(),
    }),
  ),
  deferred_to_next_sprint: z
    .array(
      z.object({
        task_id: z.string(),
        title: z.string(),
        reason: z.string(),
      }),
    )
    .optional(),
  total_planned_points: z.number(),
  capacity_utilization_percent: z.number().optional(),
  sprint_health_indicators: z
    .object({
      dependency_risk: z.enum(["low", "medium", "high"]),
      skill_coverage: z.enum(["good", "partial", "poor"]),
      scope_stability: z.enum(["stable", "moderate", "volatile"]),
      overall_confidence: z.enum(["high", "medium", "low"]),
    })
    .optional(),
});

const RiskAssessmentSchema = z.object({
  change_impact_summary: z.object({
    overall_risk_level: z.enum(["critical", "high", "medium", "low"]),
    confidence: z.enum(["high", "medium", "low"]),
    summary: z.string(),
  }),
  new_risks: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        severity: z.enum(["critical", "high", "medium", "low"]),
        likelihood: z.enum(["very_likely", "likely", "possible", "unlikely"]),
        affected_workstreams: z.array(z.string()),
        mitigation_strategy: z.string(),
      }),
    )
    .optional(),
  escalations: z
    .array(
      z.object({
        risk_id: z.string(),
        previous_severity: z.string(),
        new_severity: z.string(),
        reason: z.string(),
        recommended_action: z.string(),
      }),
    )
    .optional(),
  cascade_impacts: z
    .array(
      z.object({
        trigger: z.string(),
        affected_areas: z.array(z.string()),
        impact_description: z.string(),
        probability: z.enum(["high", "medium", "low"]),
      }),
    )
    .optional(),
  recommendations: z
    .array(
      z.object({
        priority: z.enum(["immediate", "short_term", "long_term"]),
        action: z.string(),
        expected_outcome: z.string(),
        effort: z.enum(["low", "medium", "high"]),
      }),
    )
    .optional(),
});

const GateEvaluationSchema = z.object({
  overall_readiness_percent: z.number().min(0).max(100),
  gate_criteria_status: z.array(
    z.object({
      criterion: z.string(),
      status: z.enum(["passed", "failed", "partial", "not_evaluated"]),
      score: z.number().min(0).max(100),
      evidence: z.string(),
      notes: z.string().optional(),
    }),
  ),
  critical_blockers: z.array(
    z.object({
      blocker: z.string(),
      severity: z.enum(["critical", "high"]),
      resolution_path: z.string(),
      estimated_effort: z.string(),
    }),
  ),
  health_assessment: z.object({
    schedule_health: z.enum(["on_track", "at_risk", "behind"]),
    quality_health: z.enum(["good", "acceptable", "poor"]),
    team_health: z.enum(["strong", "adequate", "strained"]),
    budget_health: z.enum(["on_track", "at_risk", "over"]),
    summary: z.string(),
  }),
  recommendations: z.array(
    z.object({
      recommendation: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      category: z.enum(["process", "technical", "team", "scope"]),
    }),
  ),
  next_steps: z.array(
    z.object({
      action: z.string(),
      owner: z.string().optional(),
      deadline: z.string().optional(),
      dependency: z.string().optional(),
    }),
  ),
});

// ================================================================
// Tests
// ================================================================

describe("DiscoveryFindingsSchema", () => {
  it("validates correct data", () => {
    const valid = {
      suggested_requirements: [
        {
          title: "Payment Integration",
          description: "Implement payment gateway",
          category: "technical",
          priority: "high",
          rationale: "Core feature",
        },
      ],
      identified_gaps: [
        {
          area: "Security",
          description: "No SSO",
          severity: "critical",
          suggested_action: "Implement SAML",
        },
      ],
      risk_indicators: [
        {
          indicator: "Data migration complexity",
          risk_level: "medium",
          affected_workstreams: ["Data", "Integration"],
          mitigation_suggestion: "Phased migration",
        },
      ],
      key_insights: [
        {
          insight: "Legacy system has undocumented APIs",
          confidence: "low",
          source_context: "Technical interview notes",
        },
      ],
    };
    expect(DiscoveryFindingsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid priority enum", () => {
    const invalid = {
      suggested_requirements: [
        {
          title: "Req",
          description: "Desc",
          category: "cat",
          priority: "urgent",
          rationale: "reason",
        },
      ],
      identified_gaps: [],
      risk_indicators: [],
      key_insights: [],
    };
    expect(DiscoveryFindingsSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const invalid = {
      suggested_requirements: [],
      // missing identified_gaps, risk_indicators, key_insights
    };
    expect(DiscoveryFindingsSchema.safeParse(invalid).success).toBe(false);
  });

  it("allows empty arrays", () => {
    const valid = {
      suggested_requirements: [],
      identified_gaps: [],
      risk_indicators: [],
      key_insights: [],
    };
    expect(DiscoveryFindingsSchema.safeParse(valid).success).toBe(true);
  });
});

describe("RefinementSchema", () => {
  const validBase = {
    overall_assessment: {
      clarity_score: 7,
      completeness_score: 5,
      testability_score: 8,
      summary: "Good but needs work",
    },
    suggestions: [
      {
        area: "description",
        current_text: "Old text",
        suggested_text: "New text",
        reason: "Clarity",
        priority: "medium" as const,
      },
    ],
  };

  it("validates correct data", () => {
    expect(RefinementSchema.safeParse(validBase).success).toBe(true);
  });

  it("validates with optional fields", () => {
    const valid = {
      ...validBase,
      potential_split: {
        should_split: true,
        reason: "Too broad",
        proposed_sub_requirements: [{ title: "Sub-req A", description: "Part A" }],
      },
      related_requirements: [
        {
          requirement_id: "REQ-001",
          relationship: "depends_on" as const,
          description: "Depends on auth",
        },
      ],
    };
    expect(RefinementSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects scores outside 1-10 range", () => {
    const invalid = {
      ...validBase,
      overall_assessment: {
        ...validBase.overall_assessment,
        clarity_score: 15,
      },
    };
    expect(RefinementSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid relationship enum", () => {
    const invalid = {
      ...validBase,
      related_requirements: [
        {
          requirement_id: "REQ-001",
          relationship: "related_to",
          description: "Some relation",
        },
      ],
    };
    expect(RefinementSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("TaskDecompositionSchema", () => {
  const valid = {
    decomposition_rationale: "Split into frontend and backend",
    critical_considerations: ["API compatibility"],
    tasks: [
      {
        title: "Build API",
        description: "REST endpoints",
        acceptance_criteria: ["Tests pass"],
        story_points: 5,
        dependencies: [],
        required_skills: ["Node.js"],
        risk_factors: ["New framework"],
      },
    ],
    estimated_total_points: 5,
  };

  it("validates correct data", () => {
    expect(TaskDecompositionSchema.safeParse(valid).success).toBe(true);
  });

  it("validates with optional sprint count", () => {
    const withSprints = { ...valid, estimated_sprint_count: 2 };
    expect(TaskDecompositionSchema.safeParse(withSprints).success).toBe(true);
  });

  it("rejects missing required task fields", () => {
    const invalid = {
      ...valid,
      tasks: [{ title: "Incomplete task" }],
    };
    expect(TaskDecompositionSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects missing decomposition_rationale", () => {
    const { decomposition_rationale, ...rest } = valid;
    expect(TaskDecompositionSchema.safeParse(rest).success).toBe(false);
  });
});

describe("SprintCompositionSchema", () => {
  const valid = {
    capacity_analysis: {
      total_capacity_points: 40,
      available_team_members: 4,
      risk_buffer_percent: 20,
      effective_capacity: 32,
    },
    recommended_tasks: [
      {
        task_id: "TASK-1",
        title: "Auth module",
        story_points: 8,
        priority: "critical" as const,
        rationale: "Security blocker",
      },
    ],
    total_planned_points: 8,
  };

  it("validates correct data", () => {
    expect(SprintCompositionSchema.safeParse(valid).success).toBe(true);
  });

  it("validates with all optional fields", () => {
    const full = {
      ...valid,
      deferred_to_next_sprint: [{ task_id: "TASK-2", title: "Reports", reason: "Capacity" }],
      capacity_utilization_percent: 87.5,
      sprint_health_indicators: {
        dependency_risk: "low" as const,
        skill_coverage: "good" as const,
        scope_stability: "stable" as const,
        overall_confidence: "high" as const,
      },
    };
    expect(SprintCompositionSchema.safeParse(full).success).toBe(true);
  });

  it("rejects invalid priority enum", () => {
    const invalid = {
      ...valid,
      recommended_tasks: [
        {
          task_id: "TASK-1",
          title: "Auth",
          story_points: 8,
          priority: "urgent",
          rationale: "reason",
        },
      ],
    };
    expect(SprintCompositionSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid health indicator enums", () => {
    const invalid = {
      ...valid,
      sprint_health_indicators: {
        dependency_risk: "extreme",
        skill_coverage: "good",
        scope_stability: "stable",
        overall_confidence: "high",
      },
    };
    expect(SprintCompositionSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("RiskAssessmentSchema", () => {
  const valid = {
    change_impact_summary: {
      overall_risk_level: "medium" as const,
      confidence: "high" as const,
      summary: "Moderate risk increase",
    },
  };

  it("validates correct data with required fields only", () => {
    expect(RiskAssessmentSchema.safeParse(valid).success).toBe(true);
  });

  it("validates with all optional fields", () => {
    const full = {
      ...valid,
      new_risks: [
        {
          title: "Data loss",
          description: "Migration could lose data",
          severity: "critical" as const,
          likelihood: "possible" as const,
          affected_workstreams: ["Data"],
          mitigation_strategy: "Backup first",
        },
      ],
      escalations: [
        {
          risk_id: "RISK-1",
          previous_severity: "medium",
          new_severity: "high",
          reason: "Scope expanded",
          recommended_action: "Add resources",
        },
      ],
      cascade_impacts: [
        {
          trigger: "API change",
          affected_areas: ["Frontend", "Mobile"],
          impact_description: "UI breaks",
          probability: "high" as const,
        },
      ],
      recommendations: [
        {
          priority: "immediate" as const,
          action: "Audit security",
          expected_outcome: "Identified vulnerabilities",
          effort: "medium" as const,
        },
      ],
    };
    expect(RiskAssessmentSchema.safeParse(full).success).toBe(true);
  });

  it("rejects invalid likelihood enum", () => {
    const invalid = {
      ...valid,
      new_risks: [
        {
          title: "Risk",
          description: "Desc",
          severity: "high",
          likelihood: "certain",
          affected_workstreams: [],
          mitigation_strategy: "None",
        },
      ],
    };
    expect(RiskAssessmentSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid recommendation priority", () => {
    const invalid = {
      ...valid,
      recommendations: [
        {
          priority: "urgent",
          action: "Do something",
          expected_outcome: "Better",
          effort: "low",
        },
      ],
    };
    expect(RiskAssessmentSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("GateEvaluationSchema", () => {
  const valid = {
    overall_readiness_percent: 75,
    gate_criteria_status: [
      {
        criterion: "Code Coverage",
        status: "passed" as const,
        score: 95,
        evidence: "Coverage report shows 95%",
      },
    ],
    critical_blockers: [
      {
        blocker: "Missing staging env",
        severity: "critical" as const,
        resolution_path: "Request from DevOps",
        estimated_effort: "2 days",
      },
    ],
    health_assessment: {
      schedule_health: "at_risk" as const,
      quality_health: "good" as const,
      team_health: "adequate" as const,
      budget_health: "on_track" as const,
      summary: "Mostly on track with some delays",
    },
    recommendations: [
      {
        recommendation: "Add more tests",
        priority: "high" as const,
        category: "technical" as const,
      },
    ],
    next_steps: [
      {
        action: "Deploy to staging",
        owner: "DevOps team",
      },
    ],
  };

  it("validates correct data", () => {
    expect(GateEvaluationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects readiness outside 0-100 range", () => {
    const invalid = { ...valid, overall_readiness_percent: 150 };
    expect(GateEvaluationSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects negative readiness", () => {
    const invalid = { ...valid, overall_readiness_percent: -5 };
    expect(GateEvaluationSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid gate status enum", () => {
    const invalid = {
      ...valid,
      gate_criteria_status: [
        {
          criterion: "Test",
          status: "skipped",
          score: 0,
          evidence: "None",
        },
      ],
    };
    expect(GateEvaluationSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid blocker severity", () => {
    const invalid = {
      ...valid,
      critical_blockers: [
        {
          blocker: "Issue",
          severity: "medium",
          resolution_path: "Fix it",
          estimated_effort: "1 day",
        },
      ],
    };
    expect(GateEvaluationSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects invalid health assessment enums", () => {
    const invalid = {
      ...valid,
      health_assessment: {
        ...valid.health_assessment,
        schedule_health: "excellent",
      },
    };
    expect(GateEvaluationSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates score at boundary values", () => {
    const atZero = {
      ...valid,
      gate_criteria_status: [
        {
          criterion: "Test",
          status: "failed" as const,
          score: 0,
          evidence: "No tests",
        },
      ],
    };
    expect(GateEvaluationSchema.safeParse(atZero).success).toBe(true);

    const at100 = {
      ...valid,
      gate_criteria_status: [
        {
          criterion: "Test",
          status: "passed" as const,
          score: 100,
          evidence: "All pass",
        },
      ],
    };
    expect(GateEvaluationSchema.safeParse(at100).success).toBe(true);
  });

  it("validates with optional next_steps fields", () => {
    const withOptionals = {
      ...valid,
      next_steps: [
        {
          action: "Deploy",
          owner: "DevOps",
          deadline: "2024-02-15",
          dependency: "Staging env ready",
        },
      ],
    };
    expect(GateEvaluationSchema.safeParse(withOptionals).success).toBe(true);
  });
});
