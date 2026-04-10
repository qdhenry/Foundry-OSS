---
name: audit-codebase
description: Run a comprehensive governance audit across the Foundry codebase. Spawns parallel agents for security, design system, and Convex pattern review. Use when you want a full compliance report.
---

<objective>
Run a comprehensive governance audit across the entire Foundry codebase by spawning three specialized agents in parallel, then aggregating results into a unified governance report.
</objective>

<process>

<step_1>
**Spawn all three governance agents in parallel using the Task tool:**

1. **codebase-expert** (subagent_type: "general-purpose")
   - Prompt: "You are the codebase-expert governance agent. Read `.claude/governance/agents/codebase-expert.md` for your full instructions. Perform a full codebase review of the Foundry platform. Check all convex/ files for security patterns (assertOrgAccess, withIndex, no raw ctx.auth), webhook patterns, provider wrapping order, and Next.js 15 async params. Report all findings with file:line references."

2. **design-system-reviewer** (subagent_type: "general-purpose")
   - Prompt: "You are the design-system-reviewer governance agent. Read `.claude/governance/agents/design-system-reviewer.md` for your full instructions. Perform a full design system compliance review. Check all src/**/*.tsx and src/**/*.css files for arbitrary colors, purple usage, CSS token compliance, component utility class usage, typography consistency, and dark mode patterns. Report with compliance scores."

3. **convex-pattern-auditor** (subagent_type: "general-purpose")
   - Prompt: "You are the convex-pattern-auditor governance agent. Read `.claude/governance/agents/convex-pattern-auditor.md` for your full instructions. Perform a full Convex pattern audit. Read convex/schema.ts for index coverage. Check all convex/ function files for naming conventions, validator patterns, security coverage, and audit logging. Report with coverage tables."
</step_1>

<step_2>
**Aggregate results into a unified governance report:**

Present the combined findings organized by severity:
1. **CRITICAL** — Security and data integrity violations (must fix immediately)
2. **BLOCKING** — Pattern violations that will cause issues (must fix before merge)
3. **WARNING** — Style and convention issues (should fix)
4. **INFO** — Suggestions and observations

Include per-domain compliance scores and a summary.
</step_2>

</process>

<success_criteria>
- All three agents complete their scans
- Findings are aggregated by severity
- Every finding includes file:line reference
- Per-domain compliance score reported
- Summary with total violations by severity
</success_criteria>
