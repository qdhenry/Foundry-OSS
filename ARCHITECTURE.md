# Architecture

This document describes how Foundry works internally. It's written for contributors who want to understand the system before changing it.

## System overview

Foundry is a four-process distributed system in development and a three-platform deployment in production.

```
Local development:
  Browser → Next.js (port 3000) ↔ Convex dev server ↔ Express agent-service (port 3001)
                                                      ↔ Wrangler sandbox-worker (port 8788)

Production:
  Browser → Vercel (Next.js) ↔ Convex Cloud ↔ Cloudflare agent-worker
                                             ↔ Cloudflare sandbox-worker
```

There is no traditional REST/GraphQL API layer for data. Convex queries and mutations are called directly from React components via `useQuery()` and `useMutation()` hooks. All data is automatically reactive — changes propagate to every connected client in real time.

External integrations (AI inference, sandbox execution, webhooks) run as Convex actions, which can make HTTP calls, use Node.js libraries, and call external services. The key distinction: mutations are transactional but sandboxed, actions are unrestricted but not transactional.

## Data model

### Hierarchy

```
Organization (Clerk org ID)
  └── Program
       ├── Workstreams (logical groupings of related requirements)
       │    └── Requirements (what needs to be built)
       ├── Skills (reusable agent capabilities, e.g., "Salesforce B2B Commerce Data Migration")
       ├── Tasks (executable units decomposed from requirements)
       │    └── Subtasks (granular steps within a task)
       ├── Risks (identified delivery risks with severity/likelihood)
       └── Sprint Gates (phase-based delivery checkpoints)
```

Every tenant-scoped table has an `orgId` field. Every query and mutation calls `assertOrgAccess(ctx, orgId)` to enforce row-level security. This function validates the JWT identity against the user's organization memberships — it's the security boundary for multi-tenancy.

### Table domains

The schema has 80+ tables organized into functional domains:

**Core delivery** — `programs`, `workstreams`, `requirements`, `skills`, `skillVersions`, `risks`, `sprintGates`, `tasks`, `sprints`, `agentExecutions`, `users`, `teamMembers`, `auditLog`, `comments`, `evidence`, `playbooks`, `playbookInstances`, `workstreamDependencies`

**Discovery & analysis** — `documents`, `documentAnalyses`, `analysisActivityLogs`, `discoveryFindings`, `dailyDigestCache`, `aiHealthScores`, `refinementSuggestions`, `taskDecompositions`, `sprintPlanningRecommendations`, `riskAssessments`, `sprintGateEvaluations`

**Design system** — `designAssets`, `designAnalyses`, `designTokenSets`, `designInteractions`, `taskDesignSnapshots`, `designFidelityChecks`

**Source control** — `sourceControlInstallations`, `sourceControlRepositories`, `sourceControlEvents`, `sourceControlIssueMappings`, `sourceControlPullRequests`, `sourceControlCommits`, `sourceControlDeployments`, `sourceControlReviews`, `sourceControlSyncState`, `sourceControlTokenCache`, `sourceControlRetryQueue`

**Codebase intelligence** — `codebaseAnalyses`, `codebaseGraphNodes`, `codebaseGraphEdges`, `codebaseEntityEmbeddings`, `codebaseAnalysisRuns`, `codebaseAnalysisResults`, `codebaseAnalysisSubtaskProposals`, `codebaseTours`, `codebaseChatMessages`, `codebaseAnalysisLogs`

**Video analysis** — `videoAnalyses`, `twelveLabsIndexes`, `videoActivityLogs`, `videoTranscripts`, `videoFrameExtractions`, `videoFindings`, `visualDiscoveryArtifacts`

**Billing & metering** — `pricingPlans`, `subscriptions`, `trialState`, `billingEvents`, `usagePeriods`

**Infrastructure** — `presence`, `activityEvents`, `aiModelCache`, `codeSnippets`, `aiUsageRecords`, `serviceHealthChecks`, `serviceIncidents`, `aiOperationCheckpoints`

**Integrations** — `integrations`, `atlassianConnections`, `googleDriveCredentials`

The schema is defined in `convex/schema.ts` (2,834 lines). Every table has typed fields (Convex validators) and indexes declared inline. Indexes are critical — Convex queries must use `.withIndex()` for acceptable performance. Using `.filter()` causes full table scans and is prohibited.

## AI integration

### Three-tier model deployment

| Tier | Model | Use case |
|------|-------|----------|
| Flagship | `claude-opus-4-6` | Document analysis, complex requirement extraction |
| Standard | `claude-sonnet-4-5-20250929` | Agent service routes, health scoring, subtask generation |
| Fast | `claude-sonnet-4-5-20250514` | Core skill execution in sandboxes |

### Context assembly pipeline

Before every AI call, Foundry assembles a structured XML prompt from up to six layers. This is the core intellectual property of the platform — it's what makes AI agents reason about delivery context rather than just generating code in isolation.

The pipeline lives in `convex/model/context.ts`:

1. **Program context** (~200 tokens) — Client name, engagement type, platform details, migration corridors
2. **Requirements** (~500-2K tokens) — Filtered by workstream, including status, acceptance criteria, and dependencies
3. **Skill content** (~2-10K tokens) — Full skill definition: instructions, constraints, verification criteria, example outputs
4. **Execution history** (~300-800 tokens) — Recent agent execution results for this skill/requirement combination
5. **Design snapshot** (variable) — Frozen design tokens, component specs, screen specs, interaction patterns
6. **Codebase analysis** (variable) — Implementation status of related requirements, evidence summaries, gap descriptions

The assembled prompt uses XML tags for structure (`<program>`, `<requirements>`, `<skill>`, `<codebase_analysis>`). Claude handles structured XML well and it makes the context layers inspectable.

Prompt caching (`cache_control: { type: "ephemeral" }`) is applied to the program and requirements layers, which are stable across multiple calls within a session. This reduces cost by ~90% for repeated context.

### Design context cascade

Design tokens follow a cascade model: `Program → Workstream → Requirement`, with merge semantics at each level (child overrides parent for conflicting keys). When a task is created, the resolved design context is snapshotted and frozen into `taskDesignSnapshots`. Sandboxes receive the snapshot, not the live cascade. This means design can evolve without disrupting in-flight work.

## Sandbox execution

The sandbox system is Foundry's most complex subsystem. It provisions ephemeral Docker containers with full AI coding environments.

### Architecture

```
Convex (orchestrator.ts, 4,152 lines)
  → HTTP request → Cloudflare Worker (sandbox-worker/)
    → Durable Object (SessionStore)
      → Docker Container (Dockerfile: Claude Code + git + Node.js)
```

### 10-stage setup lifecycle

Each sandbox session progresses through a state machine with formal transition rules:

```
containerProvision → systemSetup → authSetup → claudeConfig → gitClone
  → depsInstall → mcpInstall → workspaceCustomization → healthCheck → ready
```

Each stage reports progress back to Convex via webhook callbacks. The UI renders real-time progress indicators. If any stage fails, the session enters an error state with diagnostic information.

### Session lifecycle

1. **Launch**: User assigns a task to a sandbox. Orchestrator checks billing gates, resolves configuration (skill, design snapshot, repo access), and sends a launch request to the sandbox worker.
2. **Setup**: The 10-stage pipeline provisions the container, clones the repo, installs dependencies, and configures the AI coding environment.
3. **Execution**: The sandbox runs Claude Code with full project context. Real-time log streaming and interactive chat are available via WebSocket. A PostToolUse hook auto-commits and pushes changes on a 5-second debounce.
4. **Completion**: The sandbox pushes a final commit, optionally creates a PR, and reports results back to Convex. The container is destroyed.

### Queue and fleet management

When the sandbox worker is at capacity, launch requests enter a queue with position tracking. The orchestrator drains the queue periodically (30s intervals, configurable batch size). Fleet management — monitoring multiple concurrent sessions, load balancing, priority scheduling — is an enterprise feature.

## Webhook processing

Both GitHub and Atlassian integrations follow a durable event buffer pattern:

1. HTTP endpoint validates HMAC signature (constant-time comparison)
2. Raw event is stored in a buffer table with `status: "pending"`
3. `ctx.scheduler.runAfter(0, processorAction)` triggers immediate async processing
4. The HTTP handler returns `200 OK` within Convex's response window
5. The processor action parses the event, updates relevant tables, and marks the event as processed
6. Failed operations go to a retry queue with exponential backoff (5 attempts, 1-hour cap)

This pattern ensures webhook endpoints never time out (the actual work is async) and failed processing is automatically retried.

## Authentication flow

```
Browser → Clerk (JWT issued)
  → Next.js middleware validates JWT, redirects unauthenticated users
  → ConvexProviderWithClerk exchanges Clerk token for Convex auth
  → Every Convex query/mutation: ctx.auth.getUserIdentity() → assertOrgAccess()
```

The provider wrapping order matters and is a common source of bugs:

```
ClerkProvider (Server Component)
  → ConvexProviderWithClerk (Client Component)
    → ThemeProvider
      → SandboxBackendProvider
        → SandboxHUDProvider
          → SearchProvider
            → DashboardShellLayout
              → ProgramProvider (at [programId] layout level)
```

Convex must be inside Clerk. Rendering Convex hooks outside ClerkProvider causes authentication failures that are hard to debug.

## Source control integration

The GitHub integration uses a GitHub App (not OAuth) for repository access. This provides:

- Installation-level permissions (per-org, per-repo)
- Webhook events for push, PR, deployment, and review activity
- JWT-based authentication with token caching (`sourceControlTokenCache` table)
- Provider pattern (`convex/sourceControl/providers/`) for future GitLab/Gitea support

The provider factory (`convex/sourceControl/factory.ts`) returns the appropriate provider based on the installation type. Currently only GitHub is implemented, but the abstraction is in place.

## Frontend architecture

The UI follows a strict separation: all feature components live in `packages/ui/src/`, and app route pages are thin wrappers:

```typescript
// apps/web/src/app/(dashboard)/[programId]/tasks/page.tsx
"use client";
import { ProgramTasksRoute } from "@foundry/ui/tasks";
export default function ProgramTasksPage() { return <ProgramTasksRoute />; }
```

This enables the desktop app (`apps/desktop/`) to import the same `@foundry/ui` components and render them with client-side React Router instead of Next.js routing.

Path-based exports (`@foundry/ui/tasks`, `@foundry/ui/sandbox`, `@foundry/ui/dashboard-shell`) keep imports clean and enable tree-shaking.

### Styling

Tailwind CSS 4.1 with CSS-first configuration. Theming is defined via `@theme` in `globals.css` — there is no `tailwind.config.js`. Design tokens are CSS custom properties that cascade through the theme provider.

## Key files to know

| File | Lines | What it does |
|------|-------|-------------|
| `convex/schema.ts` | 2,834 | Single source of truth for the entire data model |
| `convex/sandbox/orchestrator.ts` | 4,152 | Sandbox lifecycle state machine and fleet orchestration |
| `convex/model/context.ts` | ~200 | AI context assembly pipeline |
| `convex/model/access.ts` | 49 | Row-level security (assertOrgAccess) |
| `convex/http.ts` | ~150 | Webhook HTTP endpoints (GitHub, Clerk, Stripe, Atlassian) |
| `packages/ui/src/sandbox/` | ~3,000+ | Sandbox HUD: terminal, editor, chat panel, config |
| `packages/ui/src/dashboard-shell/` | ~2,000+ | Layout shell: sidebar, header, breadcrumbs, navigation |
| `sandbox-worker/src/index.ts` | ~500+ | Cloudflare Worker entry: session management, container lifecycle |
| `agent-service/src/server.ts` | ~400+ | Express routes for AI inference (local dev) |

## Naming conventions

| What | Convention | Example |
|------|-----------|---------|
| Convex tables | camelCase plural | `agentExecutions` |
| Convex functions | camelCase verb-noun | `requirements.listByProgram` |
| React components | PascalCase | `MissionControlDashboard` |
| Route directories | kebab-case | `agent-activity` |
| Environment variables | SCREAMING_SNAKE | `NEXT_PUBLIC_CONVEX_URL` |
| UI package exports | Path-based | `@foundry/ui/tasks` |
