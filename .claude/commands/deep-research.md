---
description: Deploy multi-agent research swarm to analyze codebase features and synthesize a comprehensive report
argument-hint: [angle/focus - default: marketing analysis]
---

<objective>
Deploy a coordinated swarm of code research agents to perform deep analysis of the current codebase's features, functionalities, architecture, and capabilities. Each agent specializes in a different research dimension. After all agents report back, synthesize their findings into a single comprehensive report.

The user should be interviewed about the "angle" or perspective the report should be geared towards. If the user provides an angle via arguments ($ARGUMENTS), use that. Otherwise, conduct a brief interview using AskUserQuestion to determine the report's focus. The default angle is **detailed analysis for use in marketing the platform**.
</objective>

<context>
Project structure: !`find . -maxdepth 3 -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.rs" -o -name "*.go" \) | head -80`
Package info: @package.json
README: @README.md
Project instructions: @CLAUDE.md
</context>

<process>

## Phase 1: Determine Report Angle

If `$ARGUMENTS` is provided and non-empty, use it as the report angle/focus.

Otherwise, use `AskUserQuestion` to interview the user:

**Question 1:** "What angle should this research report focus on?"
- Options:
  - "Marketing analysis (Recommended)" — Highlight compelling features, competitive advantages, and value propositions for marketing copy and sales enablement
  - "Technical deep-dive" — Focus on architecture quality, design patterns, scalability, and engineering excellence for technical stakeholders
  - "Investor/stakeholder briefing" — Emphasize market opportunity, technical moat, product maturity, and growth potential
  - Other (user provides custom angle)

**Question 2:** "What audience is this report for?"
- Options:
  - "External (prospects, investors, partners)" — Polish language, emphasize outcomes and value
  - "Internal (leadership, team)" — Candid assessment, include areas for improvement
  - "Technical (engineers, architects)" — Deep technical detail, code-level insights
  - Other

Store the chosen angle and audience for use in agent prompts and final synthesis.

## Phase 2: Deploy Research Agents

Launch **5 parallel research agents** using the `Task` tool with `subagent_type: "Explore"`. Each agent receives the chosen angle/audience context and a specialized research mission.

### Agent 1: Architecture & Design Patterns
Research mission: Map the overall system architecture, identify design patterns used, analyze the tech stack choices, evaluate separation of concerns, and assess scalability characteristics. Document the architectural decisions and their implications.

### Agent 2: Feature & Functionality Inventory
Research mission: Catalog every user-facing feature and internal capability. For each feature, document what it does, how it works at a high level, what problems it solves, and how complete/mature it appears. Identify flagship features vs supporting functionality.

### Agent 3: Data Model & API Surface
Research mission: Analyze the data model (schema, relationships, indexes), API surface area (endpoints, queries, mutations, actions), and integration points. Assess data flow patterns, real-time capabilities, and external service integrations.

### Agent 4: AI/Intelligence & Differentiators
Research mission: Identify all AI-powered features, intelligent automation, unique differentiators, and innovative approaches. Analyze how AI is integrated, what models are used, how context is assembled, and what makes this platform's approach distinctive. Also identify any novel patterns or approaches that set this apart from conventional solutions.

### Agent 5: Code Quality & Maturity Signals
Research mission: Assess code quality indicators — testing coverage, error handling patterns, security practices, documentation quality, dependency health, and development workflow maturity. Identify signals of production-readiness vs prototype stage.

Each agent prompt MUST include:
- The chosen report angle and target audience
- Instructions to be thorough and specific (cite file paths, function names, concrete details)
- Instructions to organize findings with clear headers and bullet points
- A reminder that findings will be synthesized into a report geared toward the specified angle

## Phase 3: Synthesize Report

After ALL agents return their findings:

1. Review each agent's report for completeness and accuracy
2. Identify cross-cutting themes, standout capabilities, and key narratives
3. Synthesize everything into a single comprehensive report structured as follows:

### Report Structure

```markdown
# [Project Name] — Platform Analysis Report
> **Angle:** [chosen angle] | **Audience:** [chosen audience] | **Generated:** [date]

## Executive Summary
[2-3 paragraph overview tailored to the angle — the most important takeaways]

## Platform Overview
[What this platform is, what problem it solves, who it's for]

## Key Capabilities
[Organized feature groups with descriptions tailored to the angle]

## Architecture & Technical Foundation
[Tech stack, architectural patterns, scalability story — depth based on audience]

## AI & Intelligence Layer
[AI-powered features, how intelligence is woven into the platform]

## Data & Integration
[Data model sophistication, API surface, integration capabilities]

## Differentiators & Competitive Advantages
[What makes this unique — synthesized from all agent findings]

## Maturity Assessment
[Code quality, production readiness, development practices]

## Summary
[Final narrative tailored to the angle — call to action or key conclusions]
```

4. Save the report to `docs/research-report.md`
5. Present a summary to the user with key highlights

</process>

<output>
Files created:
- `docs/research-report.md` — The full synthesized research report
</output>

<success_criteria>
- User was interviewed about report angle (or argument was used)
- All 5 research agents deployed in parallel and returned findings
- Each agent provided specific, evidence-backed findings with file references
- Final report is comprehensive, well-structured, and tailored to the chosen angle
- Report saved to docs/research-report.md
- User receives a summary of key findings
</success_criteria>
