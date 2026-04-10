# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Foundry — a multi-tenant **Agentic Delivery Platform** that transforms how agencies and software delivery businesses turn plans, conversations, and requirements into working deliverables. The platform structures delivery knowledge (requirements, skills, workstreams, risks) and powers AI agents that reason about full project context, decompose tasks, generate code in isolated sandboxes, and push changes to repositories autonomously.

Foundry is **engagement-type agnostic** — it works for platform migrations, greenfield builds, system integrations, and ongoing product development. The data model is built around programs, workstreams, requirements, and skills — abstractions that apply to any software delivery context.

**V1 reference data:** AcmeCorp (118 requirements, 8 skills, 7 workstreams). Migration corridors: Magento → Salesforce B2B Commerce, Magento → BigCommerce B2B.

**Current state:** Active development. Four-process distributed system (Next.js frontend, Convex backend, Cloudflare sandbox worker, Express agent service). 55 database tables across six functional domains. 25+ route surfaces.

## Tech Stack (Locked)

- **Monorepo:** Bun workspaces (`apps/*`, `packages/*`, `sandbox-worker`, `agent-service`, `agent-worker`)
- **Frontend (Web):** Next.js 16.1.6 (App Router) + React 19.2.3 + TypeScript 5.9.3
- **Frontend (Desktop):** Tauri 2 (Rust + Vite + React) reusing `@foundry/ui` components
- **UI Components:** `@foundry/ui` — shared component library in `packages/ui/` (source-owned, all feature UI lives here)
- **Styling:** Tailwind CSS 4.1 (CSS-first config via `@theme` in `globals.css`, no `tailwind.config.js`)
- **Backend/Database:** Convex (reactive BaaS — document DB, real-time subscriptions, server functions, file storage)
- **Auth:** Clerk (organizations = tenants, JWT → Convex, webhook user sync)
- **AI:** Claude API (three-tier: Opus 4.6, Sonnet 4.5 v2, Sonnet 4.5) via Convex actions + Agent Service (Express 5 local / Cloudflare Worker prod)
- **Sandbox:** Cloudflare Workers + Durable Objects + Docker Containers (ephemeral Claude Code environments)
- **Deployment:** Vercel (frontend) + Convex Cloud (backend) + Cloudflare (sandbox worker + agent worker)

## Commands

```bash
# Development (local 4-process: Next.js + Convex + Express agent + sandbox worker)
bun run dev                  # Next.js dev server (apps/web)
bun run dev:convex           # Convex backend hot-reload
bun run dev:agent            # Express agent service (port 3001, Claude Code auth)
bun run dev:agent-worker     # Cloudflare agent worker (local Wrangler dev)
bun run dev:worker           # Cloudflare sandbox worker (local)
bun run dev:zellij           # Multi-pane terminal layout (all services)

# Production deployment
bunx convex deploy           # Deploy Convex backend
cd agent-worker && wrangler deploy  # Deploy agent worker to Cloudflare
# Vercel auto-deploys apps/web on push to main

# Desktop
bun run build:desktop        # Tauri desktop build

# Untitled UI components
bunx untitledui@latest add [component]   # Add source-owned component

# Dependencies
bun install convex @clerk/nextjs @anthropic-ai/sdk convex-helpers zod date-fns

# Linting & Formatting (Biome)
bun run check              # Check lint + format (no changes)
bun run check:fix          # Auto-fix lint + format issues
bun run lint               # Alias for check
bun run format             # Format check only
bun run format:fix         # Format fix only
```

## Architecture

### Dual-Mode Architecture

**Local development** runs 4 processes: Next.js + Convex + Express agent-service + sandbox worker.
**Production** runs on managed platforms: Vercel + Convex Cloud + 2 Cloudflare Workers.

```
# Production
Vercel (apps/web)
  ├── Edge Middleware (Clerk auth)
  ├── Static/SSR pages + 4 API routes (OAuth callbacks)
  └── Client WebSocket → Convex Cloud

Convex Cloud
  ├── 55 tables, server functions, AI actions
  └── HTTP calls → Cloudflare Workers

Cloudflare Workers
  ├── foundry-agent-worker (agent-worker/) — AI analysis routes, Hono + Anthropic SDK
  └── migration-sandbox-worker (sandbox-worker/) — sandbox execution, Durable Objects
```

```
# Local dev
Browser → Next.js dev server (apps/web, port 3000)
           ↕ WebSocket → Convex dev (convex/)
           ↕ HTTP → Express agent-service (port 3001, Claude Code OAuth)
           ↕ HTTP → Wrangler sandbox-worker (port 8788)
```

**Agent service dual-mode:** `convex/lib/agentServiceClient.ts` routes to either:
- **Local:** `AGENT_SERVICE_URL=http://localhost:3001` (Express, no bearer auth)
- **Production:** `AGENT_SERVICE_URL=https://foundry-agent-worker.<acct>.workers.dev` (Cloudflare Worker, bearer auth via `AGENT_SERVICE_SECRET`)

**No traditional API layer for data.** Convex queries/mutations are called directly from React via `useQuery`/`useMutation` hooks. All data is automatically reactive — changes propagate to all connected clients instantly.

### Directory Structure

```
apps/
  web/                        # Next.js 16 frontend (thin route wrappers)
    src/app/(dashboard)/      # Authenticated route group (25+ surfaces)
      [programId]/            # Program-scoped routes (discovery, skills, risks, tasks, etc.)
    src/lib/                  # convex.tsx (providers), programContext, theme
    src/middleware.ts         # Clerk auth middleware
  desktop/                    # Tauri 2 desktop app (Vite + React + Rust)
    src/shims/                # Next.js API compatibility shims
    src-tauri/                # Rust backend
packages/
  ui/                         # @foundry/ui — ALL feature UI lives here
    src/tasks/                # TaskBoard, TaskCard, TaskFilters, SubtaskPanel
    src/sandbox/              # SandboxHUD, ChatPanel, Terminal, Editor, ConfigPanel
    src/dashboard-shell/      # DashboardShellLayout, Sidebar, Header, Breadcrumbs
    src/discovery/            # DiscoveryPage, FindingsPagination, DocumentZone
    src/skills/               # SkillsPage, SkillDetail
    src/{domain}/             # One directory per domain (risks, gates, sprints, etc.)
  types/                      # Shared TypeScript types
convex/                       # Backend (55 tables, schema, functions, AI actions)
  schema.ts                   # Single source of truth for data model (61KB)
  model/access.ts             # Row-level security helpers (assertOrgAccess)
  model/context.ts            # AI context assembly pipeline
  model/audit.ts              # Dual audit trail (general + compliance)
  ai.ts                       # Claude API actions
  sandbox/                    # Sandbox orchestration (orchestrator.ts 127KB, sessions, logs)
  sourceControl/              # GitHub App integration (webhooks, PRs, repos)
  atlassian/                  # Jira/Confluence integration
  http.ts                     # 7 HTTP webhook endpoints
sandbox-worker/               # Cloudflare Worker + Durable Objects + Containers
agent-service/                # Express 5 AI inference sidecar (local dev, Claude Code OAuth)
agent-worker/                 # Cloudflare Worker AI inference (production, Hono + Anthropic SDK)
```

### Monorepo UI Architecture

All feature UI lives in `packages/ui/src/`. App route pages are ultra-thin wrappers:

```typescript
// apps/web/src/app/(dashboard)/[programId]/tasks/page.tsx
"use client";
import { ProgramTasksRoute } from "@foundry/ui/tasks";
export default function ProgramTasksPage() { return <ProgramTasksRoute />; }
```

Path-based exports: `@foundry/ui/tasks`, `@foundry/ui/sandbox`, `@foundry/ui/dashboard-shell`, etc.

The desktop app (`apps/desktop`) imports the same `@foundry/ui` components and uses client-side React Router with Next.js API shims in `src/shims/`.

### Data Model Hierarchy

`Organization (Clerk) → Program → Workstreams → Requirements ←→ Skills`

Every tenant-scoped table includes `orgId` (Clerk organization ID). Every query/mutation enforces row-level security via `assertOrgAccess()`.

### Data Model (55 Tables, 6 Domains)

- **Core Delivery (11):** programs, workstreams, requirements, skills, skillVersions, risks, sprintGates, agentExecutions, users, teamMembers, auditLog
- **AI Analysis (9):** documentAnalyses, analysisActivityLogs, discoveryFindings, dailyDigestCache, aiHealthScores, refinementSuggestions, taskDecompositions, sprintPlanningRecommendations, riskAssessments
- **Source Control (12):** GitHub App with installations, repositories, events, issue mappings, pull requests, commits, deployments, reviews, sync state, token cache, activity events, retry queue
- **Video Analysis (6):** Twelve Labs integration with transcripts, keyframes, video findings
- **Atlassian (5):** OAuth credentials (AES-256-GCM encrypted), Jira sync, Confluence publishing
- **Sandbox Execution (12):** Sessions, configs, encrypted env vault, AI provider configs, presets, queue, logs, chat, subtasks, audit records, notifications

## Critical Patterns

### Row-Level Security (mandatory on every query/mutation)

```typescript
// convex/model/access.ts
export async function assertOrgAccess(ctx, orgId: string) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Not authenticated");
  const user = await ctx.db.query("users")
    .withIndex("by_clerk_id", q => q.eq("clerkId", identity.subject)).unique();
  if (!user || !user.orgIds.includes(orgId)) throw new ConvexError("Access denied");
  return user;
}
```

### Index-Driven Queries (never use `.filter()`)

Always use `.withIndex()` for Convex queries. Define indexes in `schema.ts` for every query pattern. `.filter()` causes full table scans and kills reactive performance.

### Provider Wrapping Order

```
ClerkProvider (Server Component, app/layout.tsx)
  → ConvexProviderWithClerk (Client Component, lib/convex.tsx)
    → ThemeProvider
      → SandboxBackendProvider
        → SandboxHUDProvider
          → SearchProvider
            → DashboardShellLayout (Sidebar + Header + SandboxHUD)
              → ProgramProvider (at [programId] layout level)
```

Convex must be inside Clerk, not the other way around.

### Next.js 15+ Breaking Changes (app runs Next.js 16)

- `params` and `searchParams` are Promises — must `await` them
- `headers()` and `cookies()` are async
- Use `"skip"` token on `useQuery` when auth state is not yet resolved

### AI Integration

**Three-tier model deployment:**
| Model | Use Case |
|-------|----------|
| `claude-opus-4-6` | Document analysis (flagship extraction) |
| `claude-sonnet-4-5-20250929` | Agent service routes, health scoring, subtask generation |
| `claude-sonnet-4-5-20250514` | Core skill execution (`executeSkill`) |

**Context Assembly Pipeline:** Convex action assembles structured XML prompt from five layers before calling Claude:
1. Program context (~200 tokens)
2. Requirements filtered by workstream (~500-2K tokens)
3. Full skill content (~2-10K tokens)
4. Recent execution history (~300-800 tokens)
5. Task prompt with XML tags

Uses prompt caching (`cache_control: { type: "ephemeral" }`) for 90% cost reduction on repeated context.

**Key AI patterns:** Extended thinking (6-8K tokens for complex tasks), streaming incremental persistence (subtasks inserted as they arrive), lenient enum normalization for LLM output variance, repository structure injection into prompts, duplicate-aware extraction.

### Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Convex tables | camelCase plural | `agentExecutions` |
| Convex functions | camelCase verb-noun | `requirements.listByProgram` |
| React components | PascalCase | `MissionControlDashboard` |
| Route directories | kebab-case | `agent-activity` |
| Env variables | SCREAMING_SNAKE | `NEXT_PUBLIC_CONVEX_URL` |

### Linting & Formatting (Biome)

Biome enforces lint + format across 6 workspaces: `apps/web`, `packages/ui`, `convex`, `agent-service`, `agent-worker`, `sandbox-worker`. Config: `biome.json` (root). Tailwind CSS directives enabled.

**Enforcement:**
- **PostToolUse hook** (`biome_check.sh`): Auto-fixes formatting on every file edit, reports remaining lint issues. Blocking, 10s timeout.
- **Pre-commit hook** (lefthook): Blocks commits with lint errors on staged files.

**Rule levels:** `noExplicitAny`, `noNonNullAssertion`, `noUnusedFunctionParameters`, `noUnusedVariables`, `noUnusedImports`, `noImplicitAnyLet` are `warn` (not blocking). All other recommended rules are `error`.

### Sandbox Execution System

The flagship feature. Provisions ephemeral AI coding environments scoped to individual tasks.
- Cloudflare Worker → SessionStore Durable Object → Docker Container
- 10-stage setup: containerProvision → systemSetup → authSetup → claudeConfig → gitClone → depsInstall → mcpInstall → workspaceCustomization → healthCheck → ready
- State machine-governed lifecycle with formal `ALLOWED_TRANSITIONS` map
- Auto-commit/push via PostToolUse hooks (5s debounce)
- Real-time log streaming, interactive multi-turn chat, fleet management
- Queue-based fallback when sandbox worker is unavailable

### Webhook Processing Pattern

Both GitHub and Atlassian webhooks follow a durable event buffer pattern:
1. Validate HMAC signature (constant-time comparison)
2. Store raw event in buffer table with `status: "pending"`
3. `ctx.scheduler.runAfter(0, processorAction)` for immediate async processing
4. Return `200 OK` within the HTTP response window
5. Failed operations queued in retry table with exponential backoff (up to 5 attempts, 1h cap)

## Planning Structure

This project uses the GSD workflow. Planning artifacts:

- `.planning/PROJECT.md` — Project overview, requirements summary, key decisions
- `.planning/REQUIREMENTS.md` — All v1 requirements with IDs (FOUND-01, PROG-01, DISC-01, etc.)
- `.planning/STATE.md` — Current phase, progress, session continuity
- `.planning/research/` — Stack research, architecture patterns, pitfalls
- `.planning/config.json` — GSD workflow configuration

**Active initiative:** Design System Overhaul (`.planning/BRIEF.md`, `.planning/ROADMAP.md`)
- Phases 1-4 (Token Foundation, Layout Shell, Component Primitives, Core Pages): Complete
- Phases 5-6 (Secondary Pages, Sandbox & Polish): Not started

## UI Rules

- Never use purple color schemes. Use the existing blue/slate palette for AI features and interactive elements.

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Vercel | Clerk frontend key |
| `CLERK_SECRET_KEY` | Vercel | Clerk backend key |
| `CLERK_WEBHOOK_SECRET` | Convex Dashboard | Webhook signature verification |
| `ANTHROPIC_API_KEY` | Convex Dashboard + Wrangler | Claude API (Convex actions + agent worker) |
| `AGENT_SERVICE_URL` | Convex Dashboard + Vercel | Agent service URL (localhost:3001 dev, Worker URL prod) |
| `AGENT_SERVICE_SECRET` | Convex Dashboard + Wrangler | Bearer token for agent worker auth (prod only) |
| `SANDBOX_WORKER_URL` | Convex Dashboard | Cloudflare sandbox worker URL |
| `SANDBOX_API_SECRET` | Convex Dashboard + Wrangler | Shared secret for sandbox worker API auth |
| `GITHUB_WEBHOOK_SECRET` | Convex Dashboard | HMAC secret for GitHub webhook validation |
| `ATLASSIAN_WEBHOOK_SECRET` | Convex Dashboard | HMAC secret for Atlassian webhook validation |

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
