# convex/
Convex reactive backend. 81 tables, 8 domains. Schema in schema.ts (~70KB).

## Rules
- ALWAYS `.withIndex()`, NEVER `.filter()` (full table scan)
- ALWAYS `assertOrgAccess(ctx, orgId)` at top of every query/mutation
- Actions follow "sandwich" pattern: auth -> runQuery -> fetch external -> runMutation
- Every mutation that changes data must call `logAuditEvent()` for audit trail
- Every AI call must track tokens via `extractTokenUsage()` and calculate cost

## Subdirectories

| Directory | Purpose | LOC |
|-----------|---------|-----|
| model/ | RLS (access.ts), audit (audit.ts), AI prompts (context.ts), slugs | ~200 |
| sandbox/ | Orchestrator state machine, sessions, logs, queue, presets, env vault | ~8.2K |
| ai/ | Zod schemas, prompt templates, model caching, retry logic | ~450 |
| billing/ | Stripe integration, plan gates, usage tracking, trial logic | ~2.4K |
| sourceControl/ | GitHub provider, PR tracking, issue sync, MCP server, code health | ~10.2K |
| atlassian/ | Jira sync, Confluence publishing, OAuth, webhooks | ~7.2K |
| lib/ | Anthropic client, cost tracking, agent service client, 12-Labs | ~1.3K |
| shared/ | Video contracts, pipeline stage definitions | ~350 |

## Key Files (by complexity)

schema.ts (2270 LOC) | sandbox/orchestrator.ts (4047 LOC) | sourceControl/providers/github.ts (1119 LOC) | discoveryFindings.ts (1058 LOC) | requirements.ts (945 LOC) | seed.ts (843 LOC) | programs.ts (768 LOC) | http.ts (727 LOC, 8 endpoints)

## Table Domains (81 total)

- **Core Delivery (11):** programs, workstreams, requirements, skills, skillVersions, risks, tasks, subtasks, sprints, sprintGates, sprintGateEvaluations
- **AI & Agent (10):** agentExecutions, executionAuditRecords, playbooks, playbookInstances, taskDecompositions, refinementSuggestions, riskAssessments, sprintPlanningRecommendations, dailyDigestCache, aiHealthScores
- **Document Analysis (4):** documents, documentAnalyses, discoveryFindings, visualDiscoveryArtifacts
- **Video Analysis (6):** videoAnalyses, videoFindings, videoFrameExtractions, videoTranscripts, videoActivityLogs, twelveLabsIndexes
- **Source Control (14):** repositories, installations, commits, pullRequests, events, deployments, issueMappings, reviews, syncState, retryQueue, activityEvents, tokenCache + more
- **Atlassian (5):** atlassianConnections, atlassianWebhookEvents, jiraSyncQueue, jiraSyncRecords, confluencePageRecords
- **Sandbox (6):** sandboxSessions, sandboxConfigs, sandboxQueue, sandboxPresets, sandboxLogs, envVault
- **Billing (9):** subscriptions, pricingPlans, usageRecords, usagePeriods, billingEvents, aiUsageRecords, aiModelCache, aiProviderConfigs, trialState
- **Collaboration (5):** users, teamMembers, chatMessages, comments, notifications
- **Other (11):** auditLog, activityEvents, analysisActivityLogs, presence, integrations, codebaseAnalyses, codebaseAnalysisLogs, codebaseChatMessages, codeSnippets, codebaseGraphNodes, codebaseGraphEdges

## AI Models
opus-4-6: doc analysis | sonnet-4-5-v2: agent svc | sonnet-4-5: skill exec
Prompt caching: `cache_control: {type:"ephemeral"}` for 90% cost reduction
Lenient enums in ai/schemas.ts: `.toLowerCase().replace(/\s+/g,"_")`

## HTTP Endpoints (8)

1. `POST /clerk-users-webhook` — Svix HMAC, syncs Clerk org memberships to users.orgIds
2. `POST /api/sandbox/hook-events` — Claude Code tool use events from sandbox hooks
3. `POST /api/sandbox/completion` — Worker signals sandbox session complete
4. `POST /api/sandbox/tail-telemetry` — Cloudflare Tail Worker metrics
5. `POST /api/webhooks/github` — GitHub push/PR/issues/deployments (HMAC)
6. `POST /api/webhooks/jira` — Jira issue events (Atlassian signature)
7. `POST /api/webhooks/confluence` — Confluence page events
8. `POST /api/webhooks/stripe` — Stripe invoice/subscription events

All follow: HMAC validate -> store pending -> scheduler.runAfter(0) -> 200 OK -> retry queue (5 attempts, exp backoff)

## Billing Gates
`billing/gates.ts` — `assertWithinPlanLimits()` gates skill execution, doc analysis, sandbox sessions. Three tiers: Crucible/Forge/Foundry.

## Sandbox Orchestrator
10 stages: containerProvision->systemSetup->authSetup->claudeConfig->gitClone->depsInstall->mcpInstall->workspaceCustomization->healthCheck->ready
Fallback queue when worker down. Best-effort audit (silent catch). 15min TTL default.

## Testing
`convex-test` + Vitest. `t.withIdentity({subject:"user-1"})` for auth. 37 test files.

## Gotchas
- Composite indexes must match query field order
- skillVersions is immutable; skills.currentVersion is pointer
- executionAuditRecords embed names (prevent link rot)
- Mutations can't use Node.js APIs — only actions can (`"use node"`)
- Convex actions calling Anthropic directly is the canonical AI path; agent-service is a stateless sidecar
